import { action, env, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v, ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { ensureProfile, loadSermonWithRole } from "./lib/session.js";
import { canEdit } from "./lib/access.js";
import { proposeSection } from "./lib/ai/section.js";
import { AiError, publicMessage } from "./lib/ai/errors.js";
import { readAiConfig } from "./lib/ai/config.js";
import { createProvider } from "./lib/ai/providers/index.js";
import { runSermonGeneration } from "./lib/ai/orchestrator.js";
import { validateParams } from "./lib/ai/params.js";
import { checkGenerationAllowed, periodKey, STALE_JOB_MS, DEFAULT_PLAN } from "./lib/plans.js";

// Point d'entrée UNIQUE de la génération. Les limites sont vérifiées dans une mutation atomique
// (begin) : appeler directement les fonctions internes est impossible depuis le client.
export const generate = action({
  args: { params: v.any() },
  handler: async (ctx, { params }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError({ code: "unauthenticated", message: "Connexion requise." });

    const checked = validateParams(params);
    if (!checked.ok) throw new ConvexError({ code: "validation", message: checked.message, fields: checked.fields });

    const { jobId } = await ctx.runMutation(internal.generation.begin, { userId });
    try {
      const config = readAiConfig(env);
      const provider = createProvider(config);
      const result = await runSermonGeneration(checked.params, {
        provider,
        maxAttempts: config.maxAttempts,
        retrievePassages: (refs) => ctx.runQuery(internal.bible.passagesForRefs, { translationId: checked.params.translationId || undefined, refs }),
      });
      const sermonId = await ctx.runMutation(internal.generation.complete, { jobId, userId, params: checked.params, result });
      return { sermonId, warnings: result.warnings };
    } catch (error) {
      const code = error instanceof AiError ? error.code : "internal";
      await ctx.runMutation(internal.generation.fail, { jobId, errorCode: code });
      if (!(error instanceof AiError)) console.error("generation: erreur inattendue", error?.name); // jamais de contenu dans les logs
      throw new ConvexError({ code, message: publicMessage(error) });
    }
  },
});

export const begin = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const now = Date.now();
    const profile = await ensureProfile(ctx, userId);
    const recent = await ctx.db.query("generationJobs").withIndex("by_owner_started", (q) => q.eq("ownerId", userId)).order("desc").take(5);
    let runningJob = false;
    for (const job of recent) {
      if (job.status !== "running") continue;
      if (now - job.startedAt > STALE_JOB_MS) await ctx.db.patch(job._id, { status: "failed", errorCode: "stale", finishedAt: now });
      else runningJob = true;
    }
    const counter = await ctx.db.query("usageCounters").withIndex("by_owner_period", (q) => q.eq("ownerId", userId).eq("period", periodKey(now))).unique();
    const decision = checkGenerationAllowed({
      plan: profile.plan ?? DEFAULT_PLAN,
      used: counter?.generations ?? 0,
      sermonCount: profile.sermonCount,
      runningJob,
      lastStartedAt: recent[0]?.startedAt ?? null,
      now,
    });
    if (!decision.ok) throw new ConvexError({ code: decision.code, message: decision.message });
    const jobId = await ctx.db.insert("generationJobs", { ownerId: userId, status: "running", startedAt: now });
    return { jobId };
  },
});

export const complete = internalMutation({
  args: { jobId: v.id("generationJobs"), userId: v.id("users"), params: v.any(), result: v.any() },
  handler: async (ctx, { jobId, userId, params, result }) => {
    const now = Date.now();
    const sermonId = await ctx.db.insert("sermons", {
      ownerId: userId,
      title: result.content.title,
      status: "draft",
      params,
      content: result.content,
      sources: result.sources,
      warnings: result.warnings,
      version: 1,
      generation: { provider: result.provider, model: result.model, durationMs: result.durationMs, attempts: result.attempts },
      createdAt: now,
      updatedAt: now,
    });
    const period = periodKey(now);
    const counter = await ctx.db.query("usageCounters").withIndex("by_owner_period", (q) => q.eq("ownerId", userId).eq("period", period)).unique();
    if (counter) await ctx.db.patch(counter._id, { generations: counter.generations + 1 });
    else await ctx.db.insert("usageCounters", { ownerId: userId, period, generations: 1 });
    const profile = await ensureProfile(ctx, userId);
    await ctx.db.patch(profile._id, { sermonCount: profile.sermonCount + 1 });
    await ctx.db.patch(jobId, {
      status: "succeeded", finishedAt: now, durationMs: result.durationMs, model: result.model, sermonId,
      promptTokens: result.usage?.promptTokens ?? undefined, completionTokens: result.usage?.completionTokens ?? undefined,
    });
    return sermonId;
  },
});

export const fail = internalMutation({
  args: { jobId: v.id("generationJobs"), errorCode: v.string() },
  handler: async (ctx, { jobId, errorCode }) => {
    await ctx.db.patch(jobId, { status: "failed", errorCode, finishedAt: Date.now() });
  },
});

// ---- Régénération d'une partie : propose, ne sauvegarde JAMAIS (l'utilisateur applique via sermons.updateSection) ----
export const sermonForEdit = internalQuery({
  args: { id: v.id("sermons"), userId: v.id("users") },
  handler: async (ctx, { id, userId }) => {
    const { sermon, role } = await loadSermonWithRole(ctx, id, userId);
    if (!canEdit(role)) throw new ConvexError({ code: "forbidden", message: "Vous n'avez pas le droit de modifier ce sermon." });
    return { content: sermon.content };
  },
});

export const suggestSection = action({
  args: { id: v.id("sermons"), path: v.string(), action: v.string(), instruction: v.optional(v.string()) },
  handler: async (ctx, { id, path, action: kind, instruction }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError({ code: "unauthenticated", message: "Connexion requise." });
    let sermon;
    try { sermon = await ctx.runQuery(internal.generation.sermonForEdit, { id, userId }); }
    catch { throw new ConvexError({ code: "not_found", message: "Sermon introuvable." }); }
    const { jobId } = await ctx.runMutation(internal.generation.begin, { userId });
    const startedAt = Date.now();
    try {
      const config = readAiConfig(env);
      const provider = createProvider(config);
      const out = await proposeSection({ content: sermon.content, path, action: kind, instruction: instruction ?? "", provider, maxAttempts: config.maxAttempts });
      await ctx.runMutation(internal.generation.completeProposal, { jobId, userId, model: provider.model, durationMs: Date.now() - startedAt, promptTokens: out.usage.promptTokens, completionTokens: out.usage.completionTokens });
      return { value: out.value };
    } catch (error) {
      await ctx.runMutation(internal.generation.fail, { jobId, errorCode: error instanceof AiError ? error.code : "internal" });
      throw new ConvexError({ code: error instanceof AiError ? error.code : "internal", message: publicMessage(error) });
    }
  },
});

// Une proposition compte comme une génération (même coût IA).
export const completeProposal = internalMutation({
  args: { jobId: v.id("generationJobs"), userId: v.id("users"), model: v.string(), durationMs: v.number(), promptTokens: v.number(), completionTokens: v.number() },
  handler: async (ctx, { jobId, userId, model, durationMs, promptTokens, completionTokens }) => {
    const now = Date.now();
    const period = periodKey(now);
    const counter = await ctx.db.query("usageCounters").withIndex("by_owner_period", (q) => q.eq("ownerId", userId).eq("period", period)).unique();
    if (counter) await ctx.db.patch(counter._id, { generations: counter.generations + 1 });
    else await ctx.db.insert("usageCounters", { ownerId: userId, period, generations: 1 });
    await ctx.db.patch(jobId, { status: "succeeded", finishedAt: now, durationMs, model, promptTokens, completionTokens });
  },
});

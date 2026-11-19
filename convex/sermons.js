import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { z } from "zod";
import { fail, requireUserId, loadSermonWithRole, ensureProfile } from "./lib/session.js";
import { canEdit, canDelete } from "./lib/access.js";
import { SECTION_SCHEMAS, POINT_SCHEMA } from "./lib/ai/sermonSchema.js";
import { buildSources, collectReferenceLabels } from "./lib/bible/sources.js";
import { resolveTranslationId, retrieveFor } from "./lib/bible/queries.js";

const MAX_VERSIONS = 30;
const summary = (s) => ({ id: s._id, title: s.title, theme: s.content?.theme ?? "", mainPassage: s.content?.mainPassage ?? "", status: s.status, updatedAt: s.updatedAt, createdAt: s.createdAt });

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const rows = await ctx.db.query("sermons").withIndex("by_owner_updated", (q) => q.eq("ownerId", userId)).order("desc").take(200);
    return rows.filter((s) => !s.deletedAt).map(summary);
  },
});

export const recent = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const rows = await ctx.db.query("sermons").withIndex("by_owner_updated", (q) => q.eq("ownerId", userId)).order("desc").take(12);
    return rows.filter((s) => !s.deletedAt).slice(0, 5).map(summary);
  },
});

export const get = query({
  args: { id: v.id("sermons") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    try {
      const { sermon, role } = await loadSermonWithRole(ctx, id, userId);
      return { id: sermon._id, title: sermon.title, status: sermon.status, content: sermon.content, sources: sermon.sources, warnings: sermon.warnings, version: sermon.version, params: sermon.params, generation: sermon.generation, role, updatedAt: sermon.updatedAt, createdAt: sermon.createdAt };
    } catch {
      return null; // inexistant ou non autorisé : indiscernable
    }
  },
});

const SIMPLE_PATHS = Object.keys(SECTION_SCHEMAS);

function applyChange(content, path, value) {
  const next = structuredClone(content);
  if (path === "points") {
    next.points = z.array(POINT_SCHEMA).min(1).max(8).parse(value);
    return next;
  }
  const m = path.match(/^points\.(\d+)$/);
  if (m) {
    const index = Number(m[1]);
    if (index >= next.points.length) throw fail("invalid", "Point inexistant.");
    next.points[index] = POINT_SCHEMA.parse(value);
    return next;
  }
  if (SIMPLE_PATHS.includes(path)) {
    next[path] = SECTION_SCHEMAS[path].parse(value);
    return next;
  }
  throw fail("invalid", "Section inconnue.");
}

// Recalcule la traçabilité depuis le contenu ACTUEL : les sources ne sont jamais fournies par le client.
async function refreshSources(ctx, sermon, content) {
  const translationId = await resolveTranslationId(ctx, sermon.params?.translationId);
  const labels = collectReferenceLabels(content, sermon.params?.passage ? [sermon.params.passage] : []);
  return await buildSources(labels, (refs) => retrieveFor(ctx, translationId, refs), { inputLabel: sermon.params?.passage ?? "" });
}

async function snapshot(ctx, sermon, authorId, reason) {
  await ctx.db.insert("sermonVersions", { sermonId: sermon._id, version: sermon.version, title: sermon.title, content: sermon.content, reason, authorId, createdAt: Date.now() });
  const all = await ctx.db.query("sermonVersions").withIndex("by_sermon", (q) => q.eq("sermonId", sermon._id)).collect();
  for (const old of all.slice(0, Math.max(0, all.length - MAX_VERSIONS))) await ctx.db.delete(old._id);
}

export const updateSection = mutation({
  args: { id: v.id("sermons"), expectedVersion: v.number(), path: v.string(), value: v.any() },
  handler: async (ctx, { id, expectedVersion, path, value }) => {
    const userId = await requireUserId(ctx);
    const { sermon, role } = await loadSermonWithRole(ctx, id, userId);
    if (!canEdit(role)) throw fail("forbidden", "Vous n'avez pas le droit de modifier ce sermon.");
    if (sermon.version !== expectedVersion) throw fail("conflict", "Ce sermon a été modifié ailleurs. Rechargez-le avant de continuer.");
    let content;
    try {
      content = applyChange(sermon.content, path, value);
    } catch (error) {
      if (error?.data?.code) throw error;
      throw fail("invalid", "Contenu invalide pour cette section.");
    }
    await snapshot(ctx, sermon, userId, `avant modification : ${path}`);
    const traced = await refreshSources(ctx, sermon, content);
    await ctx.db.patch(id, { content, sources: traced.sources, warnings: traced.warnings, title: path === "title" ? content.title : sermon.title, version: sermon.version + 1, updatedAt: Date.now() });
    return { version: sermon.version + 1 };
  },
});

export const listVersions = query({
  args: { id: v.id("sermons") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    try { await loadSermonWithRole(ctx, id, userId); } catch { return []; }
    const rows = await ctx.db.query("sermonVersions").withIndex("by_sermon", (q) => q.eq("sermonId", id)).order("desc").take(MAX_VERSIONS);
    return rows.map((r) => ({ version: r.version, title: r.title, reason: r.reason, createdAt: r.createdAt }));
  },
});

export const restoreVersion = mutation({
  args: { id: v.id("sermons"), version: v.number(), expectedVersion: v.number() },
  handler: async (ctx, { id, version, expectedVersion }) => {
    const userId = await requireUserId(ctx);
    const { sermon, role } = await loadSermonWithRole(ctx, id, userId);
    if (!canEdit(role)) throw fail("forbidden", "Vous n'avez pas le droit de modifier ce sermon.");
    if (sermon.version !== expectedVersion) throw fail("conflict", "Ce sermon a été modifié ailleurs. Rechargez-le avant de continuer.");
    const target = await ctx.db.query("sermonVersions").withIndex("by_sermon", (q) => q.eq("sermonId", id).eq("version", version)).first();
    if (!target) throw fail("not_found", "Version introuvable.");
    await snapshot(ctx, sermon, userId, `avant restauration de la version ${version}`);
    const traced = await refreshSources(ctx, sermon, target.content);
    await ctx.db.patch(id, { content: target.content, sources: traced.sources, warnings: traced.warnings, title: target.title, version: sermon.version + 1, updatedAt: Date.now() });
    return { version: sermon.version + 1 };
  },
});

export const setStatus = mutation({
  args: { id: v.id("sermons"), status: v.union(v.literal("draft"), v.literal("ready")) },
  handler: async (ctx, { id, status }) => {
    const userId = await requireUserId(ctx);
    const { role } = await loadSermonWithRole(ctx, id, userId);
    if (!canEdit(role)) throw fail("forbidden", "Vous n'avez pas le droit de modifier ce sermon.");
    await ctx.db.patch(id, { status, updatedAt: Date.now() });
  },
});

export const remove = mutation({
  args: { id: v.id("sermons") },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const { sermon, role } = await loadSermonWithRole(ctx, id, userId);
    if (!canDelete(role)) throw fail("forbidden", "Vous n'avez pas le droit de supprimer ce sermon.");
    await ctx.db.patch(id, { deletedAt: Date.now() });
    const profile = await ensureProfile(ctx, sermon.ownerId);
    await ctx.db.patch(profile._id, { sermonCount: Math.max(0, profile.sermonCount - 1) });
  },
});

// Notes de prédication : personnelles, jamais partagées même si le sermon l'est.
export const getNotes = query({
  args: { id: v.id("sermons") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return "";
    try { await loadSermonWithRole(ctx, id, userId); } catch { return ""; }
    const row = await ctx.db.query("sermonNotes").withIndex("by_sermon_user", (q) => q.eq("sermonId", id).eq("userId", userId)).unique();
    return row?.body ?? "";
  },
});

export const saveNotes = mutation({
  args: { id: v.id("sermons"), body: v.string() },
  handler: async (ctx, { id, body }) => {
    const userId = await requireUserId(ctx);
    await loadSermonWithRole(ctx, id, userId);
    const text = body.slice(0, 20000);
    const row = await ctx.db.query("sermonNotes").withIndex("by_sermon_user", (q) => q.eq("sermonId", id).eq("userId", userId)).unique();
    if (row) await ctx.db.patch(row._id, { body: text, updatedAt: Date.now() });
    else await ctx.db.insert("sermonNotes", { sermonId: id, userId, body: text, updatedAt: Date.now() });
  },
});

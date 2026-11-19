import { action, env, internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal, components } from "./_generated/api";
import { v, ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { createThread, listMessages, saveMessages } from "@convex-dev/agent";
import { ensureProfile, requireUserId } from "./lib/session.js";
import { PLANS, DEFAULT_PLAN } from "./lib/plans.js";
import { readAiConfig } from "./lib/ai/config.js";
import { AiError, publicMessage } from "./lib/ai/errors.js";
import { createProvider } from "./lib/ai/providers/index.js";
import { embedTexts } from "./lib/ai/providers/gemini.js";
import { runAssistant } from "./lib/ai/assistant.js";
import { createAssistantTools } from "./lib/ai/assistantTools.js";
import { GeneratedSermonSchema } from "./lib/ai/sermonSchema.js";
import { buildSources, collectReferenceLabels } from "./lib/bible/sources.js";
import { BOOK_BY_ID } from "./lib/bible/books.js";
import { parseReference, formatReference } from "./lib/bible/reference.js";
import { fetchPassage, resolveTranslationId, retrieveFor } from "./lib/bible/queries.js";

const messageValidator = v.object({
  role: v.union(v.literal("user"), v.literal("assistant")),
  content: v.string(),
  createdAt: v.number(),
});

function boundSourceTexts(sources, characterLimit) {
  let remaining = characterLimit;
  let truncated = false;
  const bounded = sources.map((source) => {
    if (!Array.isArray(source.verses)) return source;
    const verses = [];
    for (const verse of source.verses) {
      if (remaining <= 0) {
        truncated = true;
        break;
      }
      const text = verse.text.slice(0, remaining);
      verses.push({ ...verse, text });
      remaining -= text.length;
      if (text.length < verse.text.length) {
        truncated = true;
        break;
      }
    }
    if (verses.length < source.verses.length) truncated = true;
    return { ...source, verses };
  });
  return { sources: bounded, truncated };
}

async function loadOwnedThread(ctx, threadId, userId) {
  const thread = await ctx.db.get(threadId);
  if (!thread || thread.userId !== userId) {
    throw new ConvexError({ code: "not_found", message: "Conversation introuvable." });
  }
  return thread;
}

async function readThreadMessages(ctx, componentThreadId) {
  const result = await listMessages(ctx, components.agent, {
    threadId: componentThreadId,
    paginationOpts: { cursor: null, numItems: 60 },
    excludeToolMessages: true,
  });
  return result.page
    .map((row) => {
      const message = row.message;
      const content = typeof message.content === "string"
        ? message.content
        : (message.content ?? []).filter((part) => part?.type === "text").map((part) => part.text).join("");
      return { role: message.role, content, createdAt: row._creationTime };
    })
    .filter((message) => (message.role === "user" || message.role === "assistant") && message.content)
    .reverse();
}

async function selectedTranslation(ctx, translationId) {
  if (translationId) return await resolveTranslationId(ctx, translationId);
  return await resolveTranslationId(ctx);
}

async function passageData(ctx, reference, translationId) {
  const parsed = parseReference(reference);
  if (!parsed.ok) return { ok: false, error: parsed.error, sources: [], warnings: [] };
  const activeId = await selectedTranslation(ctx, translationId);
  if (!activeId) return { ok: false, error: "Aucune édition biblique active n'est disponible.", sources: [], warnings: [] };
  const found = await fetchPassage(ctx, activeId, parsed.ref);
  const translation = await ctx.db.get(activeId);
  if (!found.length) return { ok: false, error: "Cette référence n'est pas disponible dans l'édition active.", sources: [], warnings: [] };
  const verses = [];
  let characters = 0;
  for (const verse of found) {
    if (verses.length >= 50 || characters + verse.text.length > 5000) break;
    verses.push(verse);
    characters += verse.text.length;
  }
  const warnings = verses.length < found.length
    ? [{ code: "passage_truncated", message: "Le passage est long; seule une partie a été transmise à l'assistant." }]
    : [];
  return {
    ok: true,
    reference: formatReference(parsed.ref),
    translation: { code: translation.code, name: translation.name },
    verses,
    sources: [{
      reference: formatReference(parsed.ref),
      translationId: activeId,
      translationCode: translation.code,
      translationName: translation.name,
    }],
    warnings,
  };
}

export const createConversation = mutation({
  args: { title: v.optional(v.string()) },
  returns: v.id("assistantThreads"),
  handler: async (ctx, { title }) => {
    const userId = await requireUserId(ctx);
    const cleanTitle = (title ?? "Nouvelle conversation").trim().slice(0, 100) || "Nouvelle conversation";
    const componentThreadId = await createThread(ctx, components.agent, {
      userId: String(userId),
      title: cleanTitle,
    });
    const now = Date.now();
    return await ctx.db.insert("assistantThreads", {
      userId,
      componentThreadId,
      title: cleanTitle,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const conversations = query({
  args: {},
  returns: v.array(v.object({
    id: v.id("assistantThreads"),
    title: v.string(),
    updatedAt: v.number(),
  })),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return (await ctx.db.query("assistantThreads")
      .withIndex("by_user_updated", (q) => q.eq("userId", userId))
      .order("desc")
      .take(50))
      .map((thread) => ({ id: thread._id, title: thread.title, updatedAt: thread.updatedAt }));
  },
});

export const messages = query({
  args: { threadId: v.id("assistantThreads") },
  returns: v.array(messageValidator),
  handler: async (ctx, { threadId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const thread = await loadOwnedThread(ctx, threadId, userId);
    return await readThreadMessages(ctx, thread.componentThreadId);
  },
});

export const loadThread = internalQuery({
  args: { threadId: v.id("assistantThreads"), userId: v.id("users") },
  returns: v.object({ componentThreadId: v.string() }),
  handler: async (ctx, { threadId, userId }) => {
    const thread = await loadOwnedThread(ctx, threadId, userId);
    return { componentThreadId: thread.componentThreadId };
  },
});

export const historyForAgent = internalQuery({
  args: { threadId: v.string() },
  returns: v.array(messageValidator),
  handler: async (ctx, { threadId }) => {
    return (await readThreadMessages(ctx, threadId)).slice(-20);
  },
});

export const touchConversation = internalMutation({
  args: { threadId: v.id("assistantThreads"), userId: v.id("users"), title: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { threadId, userId, title }) => {
    const thread = await loadOwnedThread(ctx, threadId, userId);
    const cleanTitle = title?.trim().slice(0, 100);
    await ctx.db.patch(threadId, {
      updatedAt: Date.now(),
      ...(thread.title === "Nouvelle conversation" && cleanTitle ? { title: cleanTitle } : {}),
    });
    return null;
  },
});

export const searchBibleForAgent = internalQuery({
  args: { userId: v.id("users"), query: v.string(), translationId: v.optional(v.id("bibleTranslations")) },
  returns: v.any(),
  handler: async (ctx, { query, translationId }) => {
    const q = query.trim().slice(0, 200);
    if (q.length < 2) return { kind: "empty", translation: null, results: [] };
    const activeId = await selectedTranslation(ctx, translationId);
    if (!activeId) return { kind: "unavailable", translation: null, results: [] };
    const translation = await ctx.db.get(activeId);
    const parsed = parseReference(q);
    if (parsed.ok) {
      const verses = await fetchPassage(ctx, activeId, parsed.ref);
      return {
        kind: "reference",
        translation: { code: translation.code, name: translation.name },
        reference: formatReference(parsed.ref),
        verses,
        results: [],
      };
    }
    const hits = await ctx.db.query("bibleVerses")
      .withSearchIndex("search_text", (search) => search.search("text", q).eq("translationId", activeId))
      .take(6);
    const results = hits.slice(0, 5).map((hit) => ({
      reference: `${BOOK_BY_ID[hit.bookId]?.name ?? hit.bookId} ${hit.chapter}:${hit.verse}`,
      bookId: hit.bookId,
      chapter: hit.chapter,
      verse: hit.verse,
      text: hit.text.slice(0, 400),
      textTruncated: hit.text.length > 400,
    }));
    return {
      kind: "text",
      translation: { code: translation.code, name: translation.name },
      results,
      warnings: [
        ...(hits.length > results.length ? [{ code: "lexical_results_truncated", message: "La recherche a retourné un échantillon de résultats lexicaux." }] : []),
        ...(results.some((result) => result.textTruncated) ? [{ code: "lexical_text_truncated", message: "Certains résultats lexicaux sont des extraits de versets." }] : []),
      ],
    };
  },
});

export const getPassageForAgent = internalQuery({
  args: { userId: v.id("users"), reference: v.string(), translationId: v.optional(v.id("bibleTranslations")) },
  returns: v.any(),
  handler: async (ctx, { reference, translationId }) => {
    return await passageData(ctx, reference, translationId);
  },
});

export const analyzeContextForAgent = internalQuery({
  args: { userId: v.id("users"), reference: v.string(), translationId: v.optional(v.id("bibleTranslations")) },
  returns: v.any(),
  handler: async (ctx, { reference, translationId }) => {
    const passage = await passageData(ctx, reference, translationId);
    if (!passage.ok) return passage;
    const parsed = parseReference(reference);
    const activeId = await selectedTranslation(ctx, translationId);
    const chapter = await ctx.db.query("bibleVerses")
      .withIndex("by_passage", (q) => q.eq("translationId", activeId).eq("bookId", parsed.ref.bookId).eq("chapter", parsed.ref.chapter))
      .take(200);
    const first = parsed.ref.verseStart ?? 1;
    const last = parsed.ref.verseEnd ?? (parsed.ref.chapterEnd ? Number.MAX_SAFE_INTEGER : first);
    return {
      ...passage,
      contextBefore: chapter.filter((verse) => verse.verse < first).slice(-3).map((verse) => ({ ...verse, text: verse.text.slice(0, 400) })),
      contextAfter: chapter.filter((verse) => verse.verse > last).slice(0, 3).map((verse) => ({ ...verse, text: verse.text.slice(0, 400) })),
      contextScope: "Versets précédents et suivants du même chapitre, selon l'édition active.",
      limitations: ["Aucune ressource historique, littéraire externe ou lexicale n'est indexée dans cette installation."],
    };
  },
});

export const verifyReferencesForAgent = internalQuery({
  args: { userId: v.id("users"), references: v.array(v.string()), translationId: v.optional(v.id("bibleTranslations")) },
  returns: v.any(),
  handler: async (ctx, { references, translationId }) => {
    const activeId = await selectedTranslation(ctx, translationId);
    const traced = await buildSources(
      references.slice(0, 12),
      (refs) => retrieveFor(ctx, activeId, refs),
    );
    const bounded = boundSourceTexts(traced.sources, 3500);
    const translation = activeId ? await ctx.db.get(activeId) : null;
    const sources = activeId
      ? bounded.sources.map((source) => ({ ...source, translationId: activeId, translationCode: translation?.code ?? "", translationName: translation?.name ?? "" }))
      : bounded.sources;
    return {
      sources,
      warnings: [
        ...(activeId ? traced.warnings : [...traced.warnings, { code: "no_translation", message: "Aucune édition biblique active : les références ne peuvent pas être vérifiées." }]),
        ...(bounded.truncated ? [{ code: "source_text_truncated", message: "Le texte des sources a été tronqué pour respecter la limite de taille de l'assistant." }] : []),
        ...(references.length > 12 ? [{ code: "reference_count_truncated", message: "Seules les 12 premières références ont été vérifiées." }] : []),
      ],
      references: sources.map((source) => source.reference),
    };
  },
});

export const translationForAgent = internalQuery({
  args: { userId: v.id("users"), translationId: v.optional(v.id("bibleTranslations")) },
  returns: v.union(v.id("bibleTranslations"), v.null()),
  handler: async (ctx, { translationId }) => await selectedTranslation(ctx, translationId),
});

export const hasSemanticChunks = internalQuery({
  args: { translationId: v.id("bibleTranslations") },
  returns: v.boolean(),
  handler: async (ctx, { translationId }) => {
    const first = await ctx.db.query("bibleChunks")
      .withIndex("by_translation_reference", (q) => q.eq("translationId", translationId))
      .first();
    return first !== null;
  },
});

export const getTranslationForAgent = internalQuery({
  args: { translationId: v.id("bibleTranslations") },
  returns: v.union(v.object({ code: v.string(), name: v.string() }), v.null()),
  handler: async (ctx, { translationId }) => {
    const translation = await ctx.db.get(translationId);
    return translation?.isActive ? { code: translation.code, name: translation.name } : null;
  },
});

export const hydrateChunks = internalQuery({
  args: { translationId: v.id("bibleTranslations"), ids: v.array(v.id("bibleChunks")) },
  returns: v.array(v.object({
    id: v.id("bibleChunks"),
    bookId: v.string(),
    chapter: v.number(),
    verseStart: v.number(),
    verseEnd: v.number(),
    text: v.string(),
    embeddingModel: v.string(),
  })),
  handler: async (ctx, { translationId, ids }) => {
    const documents = await Promise.all(ids.slice(0, 8).map((id) => ctx.db.get(id)));
    return documents
      .filter((document) => document && document.translationId === translationId)
      .map((document) => ({
        id: document._id,
        bookId: document.bookId,
        chapter: document.chapter,
        verseStart: document.verseStart,
        verseEnd: document.verseEnd,
        text: document.text,
        embeddingModel: document.embeddingModel,
      }));
  },
});

export const semanticSearchForAgent = internalAction({
  args: {
    userId: v.id("users"),
    query: v.string(),
    translationId: v.optional(v.id("bibleTranslations")),
  },
  returns: v.any(),
  handler: async (ctx, { userId, query, translationId }) => {
    const text = query.trim().slice(0, 200);
    if (text.length < 2) return { kind: "empty", results: [], sources: [], warnings: [] };
    const activeId = await ctx.runQuery(internal.assistant.translationForAgent, { userId, translationId });
    if (!activeId) {
      return {
        kind: "unavailable",
        results: [],
        sources: [],
        warnings: [{ code: "no_translation", message: "Aucune édition biblique active n'est disponible." }],
      };
    }

    const parsed = parseReference(text);
    if (parsed.ok) {
      const passage = await ctx.runQuery(internal.assistant.getPassageForAgent, { userId, reference: text, translationId: activeId });
      return { kind: "reference", results: [], sources: passage.sources, warnings: passage.warnings };
    }
    const hasChunks = await ctx.runQuery(internal.assistant.hasSemanticChunks, { translationId: activeId });
    if (!hasChunks) {
      return {
        kind: "unavailable",
        results: [],
        sources: [],
        warnings: [{ code: "semantic_index_empty", message: "La recherche sémantique n'est pas indexée pour l'édition active; la recherche lexicale reste disponible." }],
      };
    }

    const apiKey = env.AI_EMBEDDING_API_KEY
      || env.GEMINI_API_KEY
      || (!env.AI_PROVIDER || env.AI_PROVIDER === "gemini" ? env.AI_API_KEY : "");
    if (!apiKey) {
      return {
        kind: "unavailable",
        results: [],
        sources: [],
        warnings: [{ code: "embedding_config", message: "Recherche sémantique indisponible : configurez GEMINI_API_KEY ou AI_EMBEDDING_API_KEY." }],
      };
    }

    const vectors = await embedTexts([text], {
      apiKey,
      baseUrl: env.AI_EMBEDDING_BASE_URL || "https://generativelanguage.googleapis.com/v1beta",
      model: env.AI_EMBEDDING_MODEL || "gemini-embedding-001",
      timeoutMs: Number(env.AI_TIMEOUT_MS || 30_000),
      taskType: "RETRIEVAL_QUERY",
    });
    const hits = await ctx.vectorSearch("bibleChunks", "by_embedding", {
      vector: vectors[0],
      limit: 3,
      filter: (filter) => filter.eq("translationId", activeId),
    });
    const docs = await ctx.runQuery(internal.assistant.hydrateChunks, {
      translationId: activeId,
      ids: hits.map((hit) => hit._id),
    });
    const scores = new Map(hits.map((hit) => [hit._id, hit._score]));
    const translation = await ctx.runQuery(internal.assistant.getTranslationForAgent, { translationId: activeId });
    const results = docs.map((doc) => ({
      ...doc,
      score: scores.get(doc.id) ?? 0,
      reference: `${BOOK_BY_ID[doc.bookId]?.name ?? doc.bookId} ${doc.chapter}:${doc.verseStart}${doc.verseEnd === doc.verseStart ? "" : `-${doc.verseEnd}`}`,
      translation,
    }));
    return {
      kind: "semantic",
      results,
      sources: results.map((doc) => ({
        reference: doc.reference,
        translationId: activeId,
        translationCode: translation?.code ?? "",
        translationName: translation?.name ?? "",
      })),
      warnings: results.length ? [] : [{ code: "semantic_index_empty", message: "Aucun segment vectoriel n'est indexé pour cette édition." }],
    };
  },
});

export const saveSermonInternal = internalMutation({
  args: {
    userId: v.id("users"),
    title: v.string(),
    content: v.any(),
    sources: v.array(v.any()),
    warnings: v.array(v.any()),
    provider: v.string(),
    model: v.string(),
  },
  returns: v.id("sermons"),
  handler: async (ctx, args) => {
    const content = GeneratedSermonSchema.parse(args.content);
    const profile = await ensureProfile(ctx, args.userId);
    const limits = PLANS[profile.plan ?? DEFAULT_PLAN];
    if (profile.sermonCount >= limits.maxSermons) {
      throw new ConvexError({ code: "storage", message: `Limite de ${limits.maxSermons} sermons atteinte avec l'offre ${limits.label}.` });
    }
    const now = Date.now();
    const id = await ctx.db.insert("sermons", {
      ownerId: args.userId,
      title: args.title.trim().slice(0, 200) || content.title,
      status: "draft",
      params: { theme: content.theme, language: "fr" },
      content,
      sources: args.sources,
      warnings: args.warnings,
      version: 1,
      generation: { provider: args.provider, model: args.model, durationMs: 0, attempts: 1 },
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(profile._id, { sermonCount: profile.sermonCount + 1 });
    return id;
  },
});

export const sendMessage = action({
  args: { threadId: v.id("assistantThreads"), prompt: v.string() },
  returns: v.any(),
  handler: async (ctx, { threadId, prompt }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError({ code: "unauthenticated", message: "Connexion requise." });
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt || cleanPrompt.length > 4000) {
      throw new ConvexError({ code: "validation", message: "Le message doit contenir entre 1 et 4 000 caractères." });
    }
    const { componentThreadId } = await ctx.runQuery(internal.assistant.loadThread, { threadId, userId });
    const history = await ctx.runQuery(internal.assistant.historyForAgent, { threadId: componentThreadId });
    const userStringId = String(userId);
    await saveMessages(ctx, components.agent, {
      threadId: componentThreadId,
      userId: userStringId,
      order: "next",
      messages: [{ role: "user", content: cleanPrompt }],
    });

    try {
      const config = readAiConfig(env);
      const provider = createProvider(config);
      const tools = createAssistantTools({
        provider,
        searchBible: (args) => ctx.runQuery(internal.assistant.searchBibleForAgent, { ...args, userId }),
        semanticSearchBible: (args) => ctx.runAction(internal.assistant.semanticSearchForAgent, { ...args, userId }),
        getPassage: (args) => ctx.runQuery(internal.assistant.getPassageForAgent, { ...args, userId }),
        findRelatedVerses: (args) => ctx.runQuery(internal.assistant.searchBibleForAgent, { ...args, userId }),
        analyzeContext: (args) => ctx.runQuery(internal.assistant.analyzeContextForAgent, { ...args, userId }),
        verifyReferences: (args) => ctx.runQuery(internal.assistant.verifyReferencesForAgent, { ...args, userId }),
        saveSermon: async ({ title, content }) => {
          const parsed = GeneratedSermonSchema.safeParse(content);
          if (!parsed.success) throw new AiError("validation", "Le contenu proposé n'est pas un sermon complet valide.", { retryable: false });
          const labels = collectReferenceLabels(parsed.data);
          const verified = await ctx.runQuery(internal.assistant.verifyReferencesForAgent, { userId, references: labels });
          const id = await ctx.runMutation(internal.assistant.saveSermonInternal, {
            userId,
            title,
            content: parsed.data,
            sources: verified.sources,
            warnings: verified.warnings,
            provider: provider.name,
            model: provider.model,
          });
          return { sermonId: id, title, savedToPersonalLibrary: true };
        },
      });

      const result = await runAssistant({ prompt: cleanPrompt, history, provider, tools });
      const verified = result.references.length
        ? await ctx.runQuery(internal.assistant.verifyReferencesForAgent, { userId, references: result.references })
        : { sources: [], warnings: [] };
      await saveMessages(ctx, components.agent, {
        threadId: componentThreadId,
        userId: userStringId,
        order: "next",
        messages: [{ role: "assistant", content: result.answer }],
      });
      await ctx.runMutation(internal.assistant.touchConversation, {
        threadId,
        userId,
        title: cleanPrompt.slice(0, 80),
      });
      return {
        threadId,
        answer: result.answer,
        references: result.references,
        citations: verified.sources,
        warnings: [...result.warnings, ...verified.warnings],
        provider: result.provider,
        model: result.model,
      };
    } catch (error) {
      if (error instanceof ConvexError) throw error;
      if (!(error instanceof AiError)) console.error("assistant: erreur inattendue", error?.name);
      const code = error instanceof AiError ? error.code : "internal";
      throw new ConvexError({ code, message: publicMessage(error) });
    }
  },
});

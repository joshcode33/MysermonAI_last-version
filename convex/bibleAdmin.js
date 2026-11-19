// Import d'une édition biblique. Réservé à l'administrateur : exige BIBLE_IMPORT_TOKEN (variable
// d'environnement Convex). Sans cette variable, toutes ces fonctions refusent tout appel.
import { env, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { isBookId } from "./lib/bible/books.js";

function assertAdmin(token) {
  const expected = env.BIBLE_IMPORT_TOKEN;
  if (!expected || expected.length < 24) throw new Error("Import désactivé : BIBLE_IMPORT_TOKEN absent ou trop court (24 caractères minimum).");
  if (typeof token !== "string" || token.length !== expected.length) throw new Error("Accès refusé.");
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  if (diff !== 0) throw new Error("Accès refusé.");
}

export const createTranslation = mutation({
  args: {
    token: v.string(),
    code: v.string(),
    name: v.string(),
    language: v.string(),
    license: v.object({
      status: v.union(v.literal("public_domain"), v.literal("licensed"), v.literal("demo")),
      holder: v.string(),
      source: v.string(),
      url: v.optional(v.string()),
      notes: v.optional(v.string()),
      verifiedBy: v.string(),
      verifiedAt: v.number(),
      commercialUseVerified: v.boolean(),
    }),
  },
  handler: async (ctx, { token, ...data }) => {
    assertAdmin(token);
    if (!data.license.commercialUseVerified) {
      throw new Error("Import refusé : l'autorisation d'utilisation commerciale n'a pas été vérifiée.");
    }
    const existing = await ctx.db.query("bibleTranslations").withIndex("by_code", (q) => q.eq("code", data.code)).unique();
    if (existing) throw new Error(`La traduction ${data.code} existe déjà.`);
    return await ctx.db.insert("bibleTranslations", { ...data, books: [], verseCount: 0, isActive: false, isDefault: false, importedAt: Date.now() });
  },
});

export const importVerses = mutation({
  args: {
    token: v.string(),
    translationId: v.id("bibleTranslations"),
    verses: v.array(v.object({ bookId: v.string(), chapter: v.number(), verse: v.number(), text: v.string() })),
  },
  handler: async (ctx, { token, translationId, verses }) => {
    assertAdmin(token);
    if (verses.length > 400) throw new Error("Lot trop grand (400 versets maximum).");
    const translation = await ctx.db.get(translationId);
    if (!translation) throw new Error("Traduction inconnue.");
    if (translation.isActive) throw new Error("Traduction déjà activée : import refusé.");
    let inserted = 0;
    for (const x of verses) {
      if (!isBookId(x.bookId) || !Number.isInteger(x.chapter) || !Number.isInteger(x.verse) || x.chapter < 1 || x.verse < 1) throw new Error(`Verset invalide : ${x.bookId} ${x.chapter}:${x.verse}`);
      const text = x.text.trim();
      if (!text || text.length > 2500) throw new Error(`Texte invalide : ${x.bookId} ${x.chapter}:${x.verse}`);
      const dup = await ctx.db
        .query("bibleVerses")
        .withIndex("by_passage", (q) => q.eq("translationId", translationId).eq("bookId", x.bookId).eq("chapter", x.chapter).eq("verse", x.verse))
        .first();
      if (dup) continue;
      await ctx.db.insert("bibleVerses", { translationId, bookId: x.bookId, chapter: x.chapter, verse: x.verse, text });
      inserted += 1;
    }
    return { inserted };
  },
});

export const importChunks = mutation({
  args: {
    token: v.string(),
    translationId: v.id("bibleTranslations"),
    chunks: v.array(v.object({
      bookId: v.string(),
      chapter: v.number(),
      verseStart: v.number(),
      verseEnd: v.number(),
      text: v.string(),
      embedding: v.array(v.number()),
      embeddingModel: v.string(),
    })),
  },
  returns: v.object({ inserted: v.number() }),
  handler: async (ctx, { token, translationId, chunks }) => {
    assertAdmin(token);
    if (chunks.length > 20) throw new Error("Lot trop grand (20 segments vectorisés maximum).");
    const translation = await ctx.db.get(translationId);
    if (!translation || translation.isActive) throw new Error("Traduction inconnue ou déjà activée.");
    if (translation.license.commercialUseVerified !== true) {
      throw new Error("Indexation refusée : les droits commerciaux de cette édition ne sont pas attestés.");
    }

    for (const chunk of chunks) {
      if (!isBookId(chunk.bookId)
        || !Number.isInteger(chunk.chapter) || chunk.chapter < 1
        || !Number.isInteger(chunk.verseStart) || chunk.verseStart < 1
        || !Number.isInteger(chunk.verseEnd) || chunk.verseEnd < chunk.verseStart
        || !chunk.text.trim() || chunk.text.length > 6000
        || chunk.embedding.length !== 768
        || chunk.embedding.some((value) => !Number.isFinite(value))
        || !chunk.embeddingModel.trim()) {
        throw new Error(`Segment Bible invalide : ${chunk.bookId} ${chunk.chapter}:${chunk.verseStart}-${chunk.verseEnd}.`);
      }
      const duplicate = await ctx.db.query("bibleChunks")
        .withIndex("by_translation_reference", (q) => q
          .eq("translationId", translationId)
          .eq("bookId", chunk.bookId)
          .eq("chapter", chunk.chapter)
          .eq("verseStart", chunk.verseStart))
        .first();
      if (duplicate) throw new Error(`Segment déjà indexé : ${chunk.bookId} ${chunk.chapter}:${chunk.verseStart}.`);
    }

    for (const chunk of chunks) await ctx.db.insert("bibleChunks", { translationId, ...chunk });
    return { inserted: chunks.length };
  },
});

// Permet au script de comparer la base au fichier source, livre par livre, avant activation.
export const auditBook = query({
  args: { token: v.string(), translationId: v.id("bibleTranslations"), bookId: v.string() },
  handler: async (ctx, { token, translationId, bookId }) => {
    assertAdmin(token);
    const rows = await ctx.db
      .query("bibleVerses")
      .withIndex("by_passage", (q) => q.eq("translationId", translationId).eq("bookId", bookId))
      .take(3000);
    const perChapter = {};
    for (const r of rows) perChapter[r.chapter] = (perChapter[r.chapter] ?? 0) + 1;
    return { count: rows.length, perChapter };
  },
});

export const activateTranslation = mutation({
  args: {
    token: v.string(),
    translationId: v.id("bibleTranslations"),
    books: v.array(v.object({ bookId: v.string(), chapters: v.number() })),
    verseCount: v.number(),
    makeDefault: v.boolean(),
  },
  handler: async (ctx, { token, translationId, books, verseCount, makeDefault }) => {
    assertAdmin(token);
    if (makeDefault) {
      for (const t of await ctx.db.query("bibleTranslations").withIndex("by_default", (q) => q.eq("isDefault", true)).collect()) {
        await ctx.db.patch(t._id, { isDefault: false });
      }
    }
    await ctx.db.patch(translationId, { books, verseCount, isActive: true, isDefault: makeDefault, importedAt: Date.now() });
  },
});

import { query, mutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireUserId } from "./lib/session.js";
import { BOOKS, BOOK_BY_ID, isBookId } from "./lib/bible/books.js";
import { parseReference, formatReference } from "./lib/bible/reference.js";
import { fetchPassage, resolveTranslationId, retrieveFor } from "./lib/bible/queries.js";

// La Bible est lisible par les utilisateurs connectés uniquement (pas d'espace public par défaut).
async function requireReader(ctx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;
  return userId;
}

export const translations = query({
  args: {},
  handler: async (ctx) => {
    if (!(await requireReader(ctx))) return [];
    const rows = await ctx.db.query("bibleTranslations").collect();
    return rows
      .filter((t) => t.isActive)
      .map((t) => ({ id: t._id, code: t.code, name: t.name, language: t.language, isDefault: t.isDefault, verseCount: t.verseCount, license: t.license, books: t.books }));
  },
});

export const catalog = query({ args: {}, handler: async () => BOOKS });

export const chapter = query({
  args: { translationId: v.id("bibleTranslations"), bookId: v.string(), chapter: v.number() },
  handler: async (ctx, { translationId, bookId, chapter }) => {
    if (!(await requireReader(ctx)) || !isBookId(bookId) || !Number.isInteger(chapter) || chapter < 1) return null;
    const verses = await ctx.db
      .query("bibleVerses")
      .withIndex("by_passage", (q) => q.eq("translationId", translationId).eq("bookId", bookId).eq("chapter", chapter))
      .take(200);
    return { bookId, bookName: BOOK_BY_ID[bookId].name, chapter, verses: verses.map((x) => ({ verse: x.verse, text: x.text })) };
  },
});

export const passage = query({
  args: { translationId: v.id("bibleTranslations"), reference: v.string() },
  handler: async (ctx, { translationId, reference }) => {
    if (!(await requireReader(ctx))) return null;
    const parsed = parseReference(reference);
    if (!parsed.ok) return { ok: false, error: parsed.error };
    const verses = await fetchPassage(ctx, translationId, parsed.ref);
    return { ok: true, ref: parsed.ref, label: formatReference(parsed.ref), verses };
  },
});

// Référence exacte si l'entrée en est une ; sinon recherche plein texte. Ne fabrique jamais de résultat.
export const search = query({
  args: { translationId: v.id("bibleTranslations"), q: v.string() },
  handler: async (ctx, { translationId, q }) => {
    if (!(await requireReader(ctx))) return null;
    const text = q.trim().slice(0, 200);
    if (text.length < 2) return { kind: "empty", results: [] };
    const parsed = parseReference(text);
    if (parsed.ok) {
      const verses = await fetchPassage(ctx, translationId, parsed.ref);
      return { kind: "reference", ref: parsed.ref, label: formatReference(parsed.ref), verses, results: [] };
    }
    const hits = await ctx.db
      .query("bibleVerses")
      .withSearchIndex("search_text", (s) => s.search("text", text).eq("translationId", translationId))
      .take(30);
    return {
      kind: "text",
      results: hits.map((h) => ({ bookId: h.bookId, bookName: BOOK_BY_ID[h.bookId]?.name ?? h.bookId, chapter: h.chapter, verse: h.verse, text: h.text })),
    };
  },
});

// Utilisée par le moteur de génération : [{ ref, verses | null }] aligné sur `refs`.
export const passagesForRefs = internalQuery({
  args: { translationId: v.optional(v.id("bibleTranslations")), refs: v.array(v.any()) },
  handler: async (ctx, { translationId, refs }) => retrieveFor(ctx, await resolveTranslationId(ctx, translationId), refs),
});

// ---- Favoris, notes, progression de lecture (strictement personnels) ----------------
const passageArgs = { translationId: v.id("bibleTranslations"), bookId: v.string(), chapter: v.number(), verseStart: v.number(), verseEnd: v.number() };
function checkPassage(a) {
  if (!isBookId(a.bookId) || a.chapter < 1 || a.verseStart < 1 || a.verseEnd < a.verseStart) throw new Error("Passage invalide.");
}

export const listFavorites = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const rows = await ctx.db.query("bibleFavorites").withIndex("by_user", (q) => q.eq("userId", userId)).order("desc").take(200);
    return rows.map((r) => ({ ...r, bookName: BOOK_BY_ID[r.bookId]?.name ?? r.bookId }));
  },
});

export const toggleFavorite = mutation({
  args: passageArgs,
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    checkPassage(args);
    const existing = (await ctx.db.query("bibleFavorites").withIndex("by_user", (q) => q.eq("userId", userId)).collect()).find(
      (f) => f.translationId === args.translationId && f.bookId === args.bookId && f.chapter === args.chapter && f.verseStart === args.verseStart && f.verseEnd === args.verseEnd
    );
    if (existing) { await ctx.db.delete(existing._id); return { favorite: false }; }
    await ctx.db.insert("bibleFavorites", { userId, ...args, createdAt: Date.now() });
    return { favorite: true };
  },
});

export const notesForChapter = query({
  args: { bookId: v.string(), chapter: v.number() },
  handler: async (ctx, { bookId, chapter }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db.query("bibleNotes").withIndex("by_user_chapter", (q) => q.eq("userId", userId).eq("bookId", bookId).eq("chapter", chapter)).take(100);
  },
});

export const saveNote = mutation({
  args: { ...passageArgs, noteId: v.optional(v.id("bibleNotes")), body: v.string() },
  handler: async (ctx, { noteId, body, ...p }) => {
    const userId = await requireUserId(ctx);
    checkPassage(p);
    const text = body.trim().slice(0, 5000);
    if (!text) throw new Error("La note est vide.");
    if (noteId) {
      const note = await ctx.db.get(noteId);
      if (!note || note.userId !== userId) throw new Error("Note introuvable.");
      await ctx.db.patch(noteId, { body: text, updatedAt: Date.now() });
      return noteId;
    }
    return await ctx.db.insert("bibleNotes", { userId, ...p, body: text, updatedAt: Date.now() });
  },
});

export const deleteNote = mutation({
  args: { noteId: v.id("bibleNotes") },
  handler: async (ctx, { noteId }) => {
    const userId = await requireUserId(ctx);
    const note = await ctx.db.get(noteId);
    if (!note || note.userId !== userId) throw new Error("Note introuvable.");
    await ctx.db.delete(noteId);
  },
});

export const getProgress = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const p = await ctx.db.query("readingProgress").withIndex("by_user", (q) => q.eq("userId", userId)).first();
    return p ? { translationId: p.translationId, bookId: p.bookId, bookName: BOOK_BY_ID[p.bookId]?.name, chapter: p.chapter } : null;
  },
});

export const setProgress = mutation({
  args: { translationId: v.id("bibleTranslations"), bookId: v.string(), chapter: v.number() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    if (!isBookId(args.bookId) || args.chapter < 1) throw new Error("Passage invalide.");
    const existing = await ctx.db.query("readingProgress").withIndex("by_user", (q) => q.eq("userId", userId)).first();
    if (existing) await ctx.db.patch(existing._id, { ...args, updatedAt: Date.now() });
    else await ctx.db.insert("readingProgress", { userId, ...args, updatedAt: Date.now() });
  },
});

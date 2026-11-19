// Accès base de données pour les passages (partagé par l'API publique et la génération).
const MAX_VERSES = 300;

async function versesOf(ctx, translationId, bookId, chapter, from, to) {
  return await ctx.db
    .query("bibleVerses")
    .withIndex("by_passage", (q) => {
      const base = q.eq("translationId", translationId).eq("bookId", bookId).eq("chapter", chapter);
      return from != null && to != null ? base.gte("verse", from).lte("verse", to) : from != null ? base.gte("verse", from) : to != null ? base.lte("verse", to) : base;
    })
    .take(MAX_VERSES);
}

/** Retourne [{chapter, verse, text}] pour une référence analysée, ou [] si absente de la traduction. */
export async function fetchPassage(ctx, translationId, ref) {
  const out = [];
  const lastChapter = ref.chapterEnd ?? ref.chapter;
  for (let ch = ref.chapter; ch <= lastChapter && out.length < MAX_VERSES; ch += 1) {
    const isFirst = ch === ref.chapter;
    const isLast = ch === lastChapter;
    let from = null;
    let to = null;
    if (isFirst && ref.verseStart != null) from = ref.verseStart;
    if (isLast) to = ref.chapterEnd != null ? ref.verseEnd : ref.verseEnd ?? ref.verseStart;
    if (isLast && ref.chapterEnd == null && ref.verseStart == null) to = null;
    const rows = await versesOf(ctx, translationId, ref.bookId, ch, from, to);
    for (const r of rows) out.push({ chapter: r.chapter, verse: r.verse, text: r.text });
  }
  return out.slice(0, MAX_VERSES);
}

/** Traduction à utiliser : celle demandée si active, sinon la traduction par défaut active, sinon null. */
export async function resolveTranslationId(ctx, requestedId) {
  if (requestedId) {
    const t = await ctx.db.get(requestedId);
    if (t?.isActive) return t._id;
  }
  const def = await ctx.db.query("bibleTranslations").withIndex("by_default", (q) => q.eq("isDefault", true)).first();
  return def?.isActive ? def._id : null;
}

/** retrieve(refs) -> [{ ref, verses | null }] pour buildSources / orchestrateur. */
export async function retrieveFor(ctx, translationId, refs) {
  if (!translationId) return refs.map((ref) => ({ ref, verses: null }));
  const out = [];
  for (const ref of refs.slice(0, 40)) {
    const verses = await fetchPassage(ctx, translationId, ref);
    out.push({ ref, verses: verses.length ? verses.map((x) => ({ verse: x.verse, text: x.text })) : null });
  }
  return out;
}

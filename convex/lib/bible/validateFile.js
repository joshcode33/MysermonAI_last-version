import { BOOK_BY_ID } from "./books.js";

/** Valide un fichier d'import avant tout envoi : structure, doublons, trous de numérotation. */
export function validateBibleFile(file) {
  const errors = [];
  const warnings = [];
  const meta = file?.meta;
  const verses = file?.verses;
  if (!meta?.code || !meta?.name || !meta?.language) errors.push("meta.code, meta.name et meta.language sont obligatoires.");
  const lic = meta?.license;
  if (!lic || !["public_domain", "licensed", "demo"].includes(lic.status)) errors.push("meta.license.status doit être public_domain, licensed ou demo.");
  for (const k of ["holder", "source", "verifiedBy"]) if (!lic?.[k]) errors.push(`meta.license.${k} est obligatoire (provenance et licence).`);
  if (lic?.commercialUseVerified !== true) errors.push("meta.license.commercialUseVerified doit être true après vérification documentée des droits commerciaux.");
  if (!Array.isArray(verses) || verses.length === 0) errors.push("verses doit être un tableau non vide.");
  if (errors.length) return { ok: false, errors, warnings };

  const seen = new Set();
  const perBook = new Map();
  for (const x of verses) {
    if (!BOOK_BY_ID[x.bookId] || !Number.isInteger(x.chapter) || !Number.isInteger(x.verse) || x.chapter < 1 || x.verse < 1 || typeof x.text !== "string" || !x.text.trim()) {
      errors.push(`Entrée invalide : ${JSON.stringify(x).slice(0, 100)}`);
      if (errors.length > 20) break;
      continue;
    }
    const key = `${x.bookId}|${x.chapter}|${x.verse}`;
    if (seen.has(key)) { errors.push(`Doublon : ${x.bookId} ${x.chapter}:${x.verse}`); continue; }
    seen.add(key);
    const chapters = perBook.get(x.bookId) ?? new Map();
    chapters.set(x.chapter, [...(chapters.get(x.chapter) ?? []), x.verse]);
    perBook.set(x.bookId, chapters);
  }
  const books = [];
  for (const [bookId, chapters] of perBook) {
    const maxChapter = Math.max(...chapters.keys());
    for (let c = 1; c <= maxChapter; c += 1) if (!chapters.has(c)) warnings.push(`${bookId} : chapitre ${c} absent.`);
    for (const [c, vs] of chapters) {
      const max = Math.max(...vs);
      if (vs.length !== max) warnings.push(`${bookId} ${c} : numérotation avec trous (${vs.length} versets, dernier = ${max}).`);
    }
    books.push({ bookId, chapters: maxChapter });
  }
  const complete = Object.keys(BOOK_BY_ID).every((id) => perBook.has(id));
  if (!complete) warnings.push(`Édition PARTIELLE : ${perBook.size} livre(s) sur 66. Ne pas la présenter comme une Bible complète.`);
  return { ok: errors.length === 0, errors, warnings, books, verseCount: seen.size, complete };
}

import { BOOKS, BOOK_BY_ID } from "./books.js";

// Normalisation : minuscules, sans accents, sans espaces/points/apostrophes.
const normalizeKey = (raw) =>
  raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^(iii|ii|i)\s+(?=[a-z])/, (_, r) => ({ i: "1", ii: "2", iii: "3" })[r])
    .replace(/[\s.'’\-]/g, "");

const EXTRA_ALIASES = {
  GEN: ["gen"], EXO: ["exod", "exo"], LEV: ["lev"], NUM: ["nomb", "nom"], DEU: ["deut", "deu"],
  JDG: ["jug", "juges"], PSA: ["psaume", "psaumes", "psa"], PRO: ["prov"], ECC: ["eccl", "ecclesiaste"],
  SNG: ["cantique", "cantiques", "cant"], ISA: ["isaie", "esaie", "isa"], JER: ["jeremie", "jer"],
  LAM: ["lam"], EZK: ["ezechiel", "ezek", "ez"], DAN: ["dan"], HOS: ["osee"], JOL: ["joel"],
  OBA: ["abdias"], JON: ["jonas"], MIC: ["michee"], NAM: ["nah"], HAB: ["habacuc"], ZEP: ["sophonie", "soph"],
  HAG: ["aggee"], ZEC: ["zacharie", "zach"], MAL: ["malachie"], MAT: ["matt", "math"],
  MRK: ["marc", "mar"], LUK: ["luc"], JHN: ["jean", "jn"], ACT: ["actes", "act"], ROM: ["romains", "rom", "ro"],
  GAL: ["galates", "gal"], EPH: ["ephesiens", "eph"], PHP: ["philippiens", "phil"], COL: ["colossiens"],
  TIT: ["tite"], PHM: ["philemon"], HEB: ["hebreux", "heb"], JAS: ["jacques", "jac"],
  REV: ["apocalypse", "apoc", "ap"], JOB: ["jb"], JUD: ["jude"],
};

function buildAliasMap() {
  const map = new Map();
  const add = (alias, id) => {
    const key = normalizeKey(alias);
    if (!key) return;
    const existing = map.get(key);
    if (existing && existing !== id) throw new Error(`Alias de livre ambigu : "${key}" (${existing} / ${id})`);
    map.set(key, id);
  };
  for (const b of BOOKS) {
    add(b.name, b.id);
    add(b.abbr, b.id);
    for (const extra of EXTRA_ALIASES[b.id] ?? []) add(extra, b.id);
    // Livres numérotés : "1 Corinthiens" -> aussi "1 Cor", "1 Co"
    const m = b.name.match(/^([123]) (.+)$/);
    if (m) {
      const stem = normalizeKey(m[2]);
      for (const len of [2, 3, 4]) add(`${m[1]}${stem.slice(0, len)}`, b.id);
    }
  }
  return map;
}

export const ALIAS_MAP = buildAliasMap();

export function findBookId(text) {
  return ALIAS_MAP.get(normalizeKey(text)) ?? null;
}

const REF_RE = new RegExp(
  "^\\s*([1-3IVXivx]{0,3}\\s*[A-Za-zÀ-ÿ'’\\-]+(?:\\s+[A-Za-zÀ-ÿ'’\\-]+)*)\\.?\\s*" + // livre
    "(\\d{1,3})" + // chapitre (ou verset si livre à un chapitre)
    "(?:\\s*[:.,]\\s*(\\d{1,3})" + // :verset
    "(?:\\s*[-–—]\\s*(?:(\\d{1,3})\\s*[:.,]\\s*)?(\\d{1,3}))?" + // -verset ou -chapitre:verset
    ")?" +
    "(?:\\s*[-–—]\\s*(\\d{1,3}))?\\s*$", // Psaume 23-24 (plage de chapitres)
  "u"
);

/**
 * Analyse une référence ("Jean 3:16", "1 Co 13.4-7", "Ps 23", "Jude 5", "Gn 1:1-2:3").
 * Retourne { ok: true, ref } ou { ok: false, error }.
 * ref = { bookId, chapter, verseStart, verseEnd, chapterEnd }  (null si non précisé)
 */
export function parseReference(input) {
  if (typeof input !== "string" || input.length > 80) return { ok: false, error: "Référence invalide." };
  const m = input.match(REF_RE);
  if (!m) return { ok: false, error: "Référence non reconnue." };
  const [, bookText, n1, n2, cEnd, vEnd, chapterRangeEnd] = m;
  const bookId = findBookId(bookText);
  if (!bookId) return { ok: false, error: `Livre inconnu : « ${bookText.trim()} ».` };
  const book = BOOK_BY_ID[bookId];

  let chapter = Number(n1);
  let verseStart = n2 === undefined ? null : Number(n2);
  let verseEnd = null;
  let chapterEnd = null;

  if (n2 === undefined && book.chapters === 1 && n1 !== undefined) {
    // "Jude 5" / "Jude 5-7" : le nombre est un verset
    verseStart = Number(n1);
    chapter = 1;
    if (chapterRangeEnd !== undefined) verseEnd = Number(chapterRangeEnd);
  } else if (n2 === undefined) {
    if (chapterRangeEnd !== undefined) chapterEnd = Number(chapterRangeEnd);
  } else {
    if (vEnd !== undefined) verseEnd = Number(vEnd);
    if (cEnd !== undefined) chapterEnd = Number(cEnd);
  }

  if (chapter < 1 || chapter > book.chapters + 5) return { ok: false, error: `${book.name} n'a pas de chapitre ${chapter}.` };
  if (verseStart !== null && verseStart < 1) return { ok: false, error: "Numéro de verset invalide." };
  if (verseEnd !== null && chapterEnd === null && verseEnd < verseStart) return { ok: false, error: "Plage de versets inversée." };
  if (chapterEnd !== null && chapterEnd < chapter) return { ok: false, error: "Plage de chapitres inversée." };
  if (chapter > book.chapters) return { ok: false, error: `${book.name} compte ${book.chapters} chapitres.` };

  return { ok: true, ref: { bookId, chapter, verseStart, verseEnd, chapterEnd } };
}

export function formatReference(ref) {
  const book = BOOK_BY_ID[ref.bookId];
  if (!book) return "";
  let out = `${book.name} ${ref.chapter}`;
  if (ref.verseStart != null) {
    out += `:${ref.verseStart}`;
    if (ref.chapterEnd != null && ref.verseEnd != null) out += `-${ref.chapterEnd}:${ref.verseEnd}`;
    else if (ref.verseEnd != null && ref.verseEnd !== ref.verseStart) out += `-${ref.verseEnd}`;
  } else if (ref.chapterEnd != null) out += `-${ref.chapterEnd}`;
  return out;
}

/** Clé stable pour comparer deux références (utilisée pour la traçabilité). */
export const referenceKey = (ref) =>
  [ref.bookId, ref.chapter, ref.verseStart ?? "", ref.verseEnd ?? "", ref.chapterEnd ?? ""].join("|");

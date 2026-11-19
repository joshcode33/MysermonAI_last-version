import test from "node:test";
import assert from "node:assert/strict";
import { parseReference, formatReference, findBookId, ALIAS_MAP } from "../convex/lib/bible/reference.js";
import { BOOKS } from "../convex/lib/bible/books.js";

const ok = (s) => {
  const r = parseReference(s);
  assert.equal(r.ok, true, `${s} -> ${JSON.stringify(r)}`);
  return r.ref;
};

test("référence simple et variantes de séparateurs", () => {
  for (const s of ["Jean 3:16", "Jean 3.16", "Jean 3,16", "Jn 3:16", "jn. 3:16", "JEAN 3 : 16"]) {
    assert.deepEqual(ok(s), { bookId: "JHN", chapter: 3, verseStart: 16, verseEnd: null, chapterEnd: null });
  }
});

test("plages de versets et de chapitres", () => {
  assert.deepEqual(ok("1 Corinthiens 13:4-7"), { bookId: "1CO", chapter: 13, verseStart: 4, verseEnd: 7, chapterEnd: null });
  assert.deepEqual(ok("Gn 1:1-2:3"), { bookId: "GEN", chapter: 1, verseStart: 1, verseEnd: 3, chapterEnd: 2 });
  assert.deepEqual(ok("Psaume 23"), { bookId: "PSA", chapter: 23, verseStart: null, verseEnd: null, chapterEnd: null });
  assert.deepEqual(ok("Ps 23-24"), { bookId: "PSA", chapter: 23, verseStart: null, verseEnd: null, chapterEnd: 24 });
});

test("livres numérotés, chiffres romains et accents", () => {
  assert.equal(ok("1 Co 13").bookId, "1CO");
  assert.equal(ok("1Co 13").bookId, "1CO");
  assert.equal(ok("I Jean 4:8").bookId, "1JN");
  assert.equal(ok("2 Timothée 3:16").bookId, "2TI");
  assert.equal(ok("Esaie 53").bookId, "ISA");
  assert.equal(ok("Ésaïe 53").bookId, "ISA");
  assert.equal(ok("Hébreux 11:1").bookId, "HEB");
  assert.equal(ok("Apocalypse 3:20").bookId, "REV");
});

test("livres à un seul chapitre : le nombre est un verset", () => {
  assert.deepEqual(ok("Jude 5"), { bookId: "JUD", chapter: 1, verseStart: 5, verseEnd: null, chapterEnd: null });
  assert.deepEqual(ok("Jude 5-7"), { bookId: "JUD", chapter: 1, verseStart: 5, verseEnd: 7, chapterEnd: null });
});

test("rejets : livre inconnu, chapitre hors limites, plage inversée, entrée hostile", () => {
  assert.equal(parseReference("Hobbit 3:1").ok, false);
  assert.equal(parseReference("Jean 99:1").ok, false);
  assert.equal(parseReference("Jean 3:16-2").ok, false);
  assert.equal(parseReference("").ok, false);
  assert.equal(parseReference("x".repeat(500)).ok, false);
  assert.equal(parseReference("Jean 3:16; DROP TABLE").ok, false);
});

test("aller-retour parse -> format", () => {
  for (const s of ["Jean 3:16", "1 Corinthiens 13:4-7", "Genèse 1:1-2:3", "Psaumes 23"]) {
    assert.equal(formatReference(ok(s)), s);
  }
});

test("aucun alias ambigu et chaque livre se retrouve par son nom et son abréviation", () => {
  assert.ok(ALIAS_MAP.size > 100);
  for (const b of BOOKS) {
    assert.equal(findBookId(b.name), b.id, b.name);
    assert.equal(findBookId(b.abbr), b.id, b.abbr);
  }
});

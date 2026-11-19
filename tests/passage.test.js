import test from "node:test";
import assert from "node:assert/strict";
import { fetchPassage } from "../convex/lib/bible/queries.js";
import { parseReference } from "../convex/lib/bible/reference.js";

// Base simulée (données SYNTHÉTIQUES) qui imite l'index by_passage de Convex.
function fakeCtx(rows) {
  return {
    db: {
      query() {
        return {
          withIndex(_name, build) {
            const c = {};
            const q = {
              eq(k, v) { c[k] = ["eq", v]; return q; },
              gte(k, v) { c.verseGte = v; return q; },
              lte(k, v) { c.verseLte = v; return q; },
            };
            build(q);
            const filtered = rows
              .filter((r) => r.translationId === c.translationId[1] && r.bookId === c.bookId[1] && r.chapter === c.chapter[1])
              .filter((r) => (c.verseGte == null || r.verse >= c.verseGte) && (c.verseLte == null || r.verse <= c.verseLte))
              .sort((a, b) => a.verse - b.verse);
            return { take: async (n) => filtered.slice(0, n) };
          },
        };
      },
    },
  };
}
const rows = [];
for (const [chapter, n] of [[1, 5], [2, 4], [3, 3]]) for (let verse = 1; verse <= n; verse++) rows.push({ translationId: "t1", bookId: "GEN", chapter, verse, text: `[TEST] ${chapter}:${verse}` });
const get = async (s, t = "t1") => (await fetchPassage(fakeCtx(rows), t, parseReference(s).ref)).map((v) => `${v.chapter}:${v.verse}`);

test("verset unique, plage, chapitre entier", async () => {
  assert.deepEqual(await get("Genèse 1:3"), ["1:3"]);
  assert.deepEqual(await get("Genèse 1:2-4"), ["1:2", "1:3", "1:4"]);
  assert.deepEqual(await get("Genèse 3"), ["3:1", "3:2", "3:3"]);
});

test("plage à cheval sur deux chapitres et plage de chapitres", async () => {
  assert.deepEqual(await get("Genèse 1:4-2:2"), ["1:4", "1:5", "2:1", "2:2"]);
  assert.deepEqual(await get("Genèse 2-3"), ["2:1", "2:2", "2:3", "2:4", "3:1", "3:2", "3:3"]);
});

test("passage absent ou autre traduction : liste vide, rien n'est inventé", async () => {
  assert.deepEqual(await get("Genèse 9"), []);
  assert.deepEqual(await get("Genèse 1:1", "autre"), []);
});

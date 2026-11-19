import test from "node:test";
import assert from "node:assert/strict";
import { validateBibleFile } from "../convex/lib/bible/validateFile.js";

const license = { status: "public_domain", holder: "Test", source: "Fixture", verifiedBy: "test", commercialUseVerified: true };
const meta = { code: "TST", name: "Fixture", language: "fr", license };
const v = (bookId, chapter, verse) => ({ bookId, chapter, verse, text: `[TEST] ${bookId} ${chapter}:${verse}` });

test("fichier valide mais partiel : signalé comme tel", () => {
  const r = validateBibleFile({ meta, verses: [v("GEN", 1, 1), v("GEN", 1, 2)] });
  assert.equal(r.ok, true);
  assert.equal(r.complete, false);
  assert.ok(r.warnings.some((w) => /PARTIELLE/.test(w)));
});

test("provenance et licence obligatoires ; doublons, livres inconnus et trous détectés", () => {
  assert.equal(validateBibleFile({ meta: { ...meta, license: { status: "public_domain" } }, verses: [v("GEN", 1, 1)] }).ok, false);
  assert.equal(validateBibleFile({ meta: { ...meta, license: { ...license, commercialUseVerified: false } }, verses: [v("GEN", 1, 1)] }).ok, false);
  assert.equal(validateBibleFile({ meta, verses: [v("GEN", 1, 1), v("GEN", 1, 1)] }).ok, false);
  assert.equal(validateBibleFile({ meta, verses: [v("XXX", 1, 1)] }).ok, false);
  const gap = validateBibleFile({ meta, verses: [v("GEN", 1, 1), v("GEN", 1, 3)] });
  assert.ok(gap.warnings.some((w) => /trous/.test(w)));
});

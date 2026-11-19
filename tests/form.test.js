import test from "node:test";
import assert from "node:assert/strict";
import { buildGenerationParams, parseDurationMinutes, errorMessage } from "../lib/sermonForm.js";
import { validateParams } from "../convex/lib/ai/params.js";
import { SERMON_TYPES } from "../convex/lib/sermonTypes.js";

test("durées du formulaire", () => {
  assert.deepEqual(["15 minutes", "30 minutes", "45 minutes", "1 heure", "1h30"].map(parseDurationMinutes), [15, 30, 45, 60, 90]);
});

test("chaque type et chaque style proposés par le formulaire produisent des paramètres valides", () => {
  for (const t of Object.values(SERMON_TYPES)) {
    for (const tone of ["Enseignement", "Encourageant", "Exhortation", "Évangélisation", "Contemplatif", "Solennel"]) {
      const p = buildGenerationParams({ title: "T", theme: "La foi", bibleReference: "Hébreux 11:1", sermonType: t.label, audience: "Église", duration: "1h30", tone, pointsCount: "4", detailLevel: "Détaillé", objective: "", mainIdeas: "", instructions: "" });
      const r = validateParams(p);
      assert.equal(r.ok, true, JSON.stringify(r));
      assert.equal(r.params.durationMinutes, 90);
    }
  }
});

test("messages d'erreur Convex lisibles, sans fuite d'erreur brute", () => {
  assert.equal(errorMessage({ data: { code: "quota", message: "Limite atteinte" } }), "Limite atteinte");
  assert.match(errorMessage(new Error("Server Error Uncaught TypeError ...")), /inattendue/);
});

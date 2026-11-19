import test from "node:test";
import assert from "node:assert/strict";
import { proposeSection, sectionSchemaFor, buildSectionPrompt } from "../convex/lib/ai/section.js";
import { buildSources } from "../convex/lib/bible/sources.js";

const content = {
  title: "T", theme: "Th", mainPassage: "Jean 3:16", objective: "O", centralIdea: "I",
  introduction: { paragraphs: ["Intro actuelle"] }, context: { paragraphs: ["C"] },
  points: [{ title: "P1", scriptureRef: "", paragraphs: ["x"], keyPoint: "k", illustration: "", application: "", transition: "" }],
  applications: [{ title: "A", text: "t" }], conclusion: { paragraphs: ["f"], call: "" }, reflectionQuestions: [], relatedReferences: [],
};
const provider = (outs) => { let i = 0; return { name: "f", model: "f", calls: [], async generate(a) { this.calls.push(a); const o = outs[Math.min(i++, outs.length - 1)]; return { text: typeof o === "string" ? o : JSON.stringify(o), usage: { promptTokens: 1, completionTokens: 2 } }; } }; };

test("proposition valide pour une introduction ; le contenu d'origine n'est pas modifié", async () => {
  const before = structuredClone(content);
  const p = provider([{ value: { paragraphs: ["Nouvelle intro"] } }]);
  const r = await proposeSection({ content, path: "introduction", action: "shorten", provider: p });
  assert.deepEqual(r.value, { paragraphs: ["Nouvelle intro"] });
  assert.deepEqual(content, before);
  assert.match(p.calls[0].messages[0].content, /Intro actuelle/);
});

test("point : structure validée ; réponse invalide réparée puis refusée si toujours invalide", async () => {
  const good = { value: { title: "P1 bis", paragraphs: ["y"], keyPoint: "k2" } };
  assert.equal((await proposeSection({ content, path: "points.0", provider: provider(["nope", good]) })).attempts, 2);
  await assert.rejects(proposeSection({ content, path: "points.0", provider: provider(["{}", "{}"]) }), (e) => e.code === "bad_response");
});

test("parties non régénérables et points inexistants refusés", () => {
  assert.throws(() => sectionSchemaFor("title"), (e) => e.code === "validation");
  assert.throws(() => buildSectionPrompt({ content, path: "points.9", action: "expand" }), (e) => e.code === "validation");
});

test("buildSources : texte uniquement issu de retrieve, doublons fusionnés", async () => {
  const retrieve = async (refs) => refs.map((ref) => ({ ref, verses: ref.bookId === "JHN" ? [{ verse: 16, text: "[TEST]" }] : null }));
  const { sources, warnings } = await buildSources(["Jean 3:16", "Jn 3.16", "Romains 1:1", "Zzz 1:1"], retrieve);
  assert.equal(sources.length, 3);
  assert.equal(sources[0].status, "verified");
  assert.deepEqual(warnings.map((w) => w.code).sort(), ["invalid_reference", "unverified_reference"]);
});

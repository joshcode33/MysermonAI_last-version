import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { AiError } from "../convex/lib/ai/errors.js";
import { runAssistant } from "../convex/lib/ai/assistant.js";
import { createAssistantTools } from "../convex/lib/ai/assistantTools.js";

const fakeTool = {
  name: "getPassage",
  description: "Retrieve an exact passage",
  parameters: { type: "object", properties: { reference: { type: "string" } }, required: ["reference"] },
  schema: z.object({ reference: z.string() }),
  async execute({ reference }) {
    return {
      reference,
      verses: [{ verse: 16, text: "[TEST] text from the fixture" }],
      sources: [{ reference, status: "verified" }],
      warnings: [],
    };
  },
};

function providerWith(outputs) {
  const calls = [];
  return {
    calls,
    provider: {
      name: "fixture",
      model: "fixture-model",
      async generate(request) {
        calls.push(request);
        const output = outputs.shift();
        if (output instanceof Error) throw output;
        return { text: output.text ?? "", toolCalls: output.toolCalls ?? [], usage: { promptTokens: 1, completionTokens: 1 }, truncated: false };
      },
    },
  };
}

test("l'assistant enchaîne un outil biblique puis valide une réponse structurée", async () => {
  const { provider, calls } = providerWith([
    { toolCalls: [{ id: "call-1", name: "getPassage", arguments: { reference: "Jean 3:16" } }] },
    { text: "Le passage parle de l'amour de Dieu." },
    { text: '{"answer":"Jean 3:16 présente l’amour de Dieu.","references":["Jean 3:16"],"uncertainties":[]}' },
  ]);
  const result = await runAssistant({ prompt: "Explique Jean 3:16", provider, tools: [fakeTool] });
  assert.equal(calls.length, 3);
  assert.equal(calls[0].tools[0].name, "getPassage");
  assert.ok(calls[1].messages.at(-1).content.includes("[TEST] text from the fixture"));
  assert.deepEqual(result.references, ["Jean 3:16"]);
  assert.deepEqual(result.verifiedReferences, ["Jean 3:16"]);
});

test("l'assistant refuse un appel d'outil inconnu", async () => {
  const { provider } = providerWith([
    { toolCalls: [{ id: "call-1", name: "pretendTool", arguments: {} }] },
  ]);
  await assert.rejects(
    runAssistant({ prompt: "Cherche un passage", provider, tools: [fakeTool] }),
    (error) => error instanceof AiError && error.code === "bad_response"
  );
});

test("l'outil de sauvegarde n'est pas proposé sans demande explicite", async () => {
  const saver = { ...fakeTool, name: "saveSermon" };
  const { provider, calls } = providerWith([
    { text: "Je peux vous aider à préparer ce sermon." },
    { text: '{"answer":"Voici une réponse.","references":[],"uncertainties":[]}' },
  ]);
  await runAssistant({ prompt: "Aide-moi à préparer un sermon", provider, tools: [fakeTool, saver] });
  assert.ok(calls[0].tools.every((tool) => tool.name !== "saveSermon"));
});

test("une sortie finale non structurée est refusée", async () => {
  const { provider } = providerWith([
    { text: "réponse libre" },
    { text: "ceci n'est pas du JSON" },
  ]);
  await assert.rejects(
    runAssistant({ prompt: "Explique la grâce", provider, tools: [fakeTool] }),
    (error) => error instanceof AiError && error.code === "bad_response"
  );
});

test("searchBible combine les implémentations lexicale et sémantique configurées", async () => {
  const calls = [];
  const tools = createAssistantTools({
    provider: {},
    searchBible: async (args) => {
      calls.push(["lexical", args.query]);
      return { results: [{ reference: "Jean 3:16" }], warnings: [] };
    },
    semanticSearchBible: async (args) => {
      calls.push(["semantic", args.query]);
      return { results: [{ reference: "Romains 5:8" }], sources: [{ reference: "Romains 5:8" }], warnings: [] };
    },
  });
  const result = await tools.find((tool) => tool.name === "searchBible").execute({ query: "grâce" });
  assert.deepEqual(calls, [["lexical", "grâce"], ["semantic", "grâce"]]);
  assert.deepEqual(result.references, ["Jean 3:16", "Romains 5:8"]);
  assert.equal(result.sources[0].reference, "Romains 5:8");
});

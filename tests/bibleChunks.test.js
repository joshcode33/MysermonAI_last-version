import test from "node:test";
import assert from "node:assert/strict";
import { chunkBibleVerses } from "../convex/lib/bible/chunks.js";
import { embedTexts } from "../convex/lib/ai/providers/gemini.js";
import { AiError } from "../convex/lib/ai/errors.js";

const verse = (bookId, chapter, number) => ({ bookId, chapter, verse: number, text: `Fixture ${bookId} ${chapter}:${number}` });

test("les segments RAG sont contigus, bornés et ne traversent pas les chapitres", () => {
  const chunks = chunkBibleVerses([
    verse("GEN", 2, 1),
    verse("GEN", 1, 6),
    verse("GEN", 1, 1),
    verse("GEN", 1, 2),
    verse("GEN", 1, 3),
    verse("GEN", 1, 4),
    verse("GEN", 1, 5),
  ]);
  assert.deepEqual(chunks.map(({ bookId, chapter, verseStart, verseEnd }) => [bookId, chapter, verseStart, verseEnd]), [
    ["GEN", 1, 1, 5],
    ["GEN", 1, 6, 6],
    ["GEN", 2, 1, 1],
  ]);
  assert.match(chunks[0].text, /^1\. Fixture GEN 1:1/);
});

test("les embeddings Gemini sont réels, dimensionnés et transmis avec la tâche RAG", async () => {
  let seen;
  const vector = Array(768).fill(0.25);
  const result = await embedTexts(["Grâce et pardon"], {
    apiKey: "test-key",
    model: "gemini-embedding-001",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    timeoutMs: 1000,
    taskType: "RETRIEVAL_QUERY",
  }, {
    fetchImpl: async (url, init) => {
      seen = { url, headers: init.headers, body: JSON.parse(init.body) };
      return new Response(JSON.stringify({ embeddings: [{ values: vector }] }), { status: 200 });
    },
  });
  assert.equal(seen.url.endsWith(":batchEmbedContents"), true);
  assert.equal(seen.headers["x-goog-api-key"], "test-key");
  assert.equal(seen.body.requests[0].taskType, "RETRIEVAL_QUERY");
  assert.equal(seen.body.requests[0].outputDimensionality, 768);
  assert.deepEqual(result, [vector]);
});

test("les embeddings absents ou de mauvaise dimension sont refusés explicitement", async () => {
  await assert.rejects(embedTexts(["question"], { model: "embed", timeoutMs: 1000 }), (error) => error.code === "config");
  await assert.rejects(embedTexts(["question"], {
    apiKey: "test",
    model: "embed",
    baseUrl: "https://example.test",
    timeoutMs: 1000,
  }, {
    fetchImpl: async () => new Response(JSON.stringify({ embeddings: [{ values: [0.1] }] }), { status: 200 }),
  }), (error) => error instanceof AiError && error.code === "bad_response");
});

// Usage : node scripts/import-bible.mjs chemin/vers/edition.json [--default]
// Variables : NEXT_PUBLIC_CONVEX_URL (ou CONVEX_URL), BIBLE_IMPORT_TOKEN (identique à celui défini sur Convex).
// Format du fichier : voir docs/BIBLE.md. L'import n'active l'édition QUE si l'audit base/fichier concorde.
import { readFileSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";
import { validateBibleFile } from "../convex/lib/bible/validateFile.js";
import { chunkBibleVerses } from "../convex/lib/bible/chunks.js";
import { embedTexts } from "../convex/lib/ai/providers/gemini.js";

const [, , path, ...flags] = process.argv;
const url = process.env.CONVEX_URL || process.env.NEXT_PUBLIC_CONVEX_URL;
const token = process.env.BIBLE_IMPORT_TOKEN;
const embedRequested = flags.includes("--embed");
const embeddingApiKey = process.env.AI_EMBEDDING_API_KEY || process.env.GEMINI_API_KEY
  || (!process.env.AI_PROVIDER || process.env.AI_PROVIDER === "gemini" ? process.env.AI_API_KEY : "");
if (!path || !url || !token) {
  console.error("Usage : node scripts/import-bible.mjs <fichier.json> [--default]  (CONVEX_URL et BIBLE_IMPORT_TOKEN requis)");
  process.exit(1);
}
if (embedRequested && !embeddingApiKey) {
  console.error("Indexation vectorielle demandée : GEMINI_API_KEY ou AI_EMBEDDING_API_KEY est requis.");
  process.exit(1);
}

const file = JSON.parse(readFileSync(path, "utf8"));
const check = validateBibleFile(file);
check.warnings.slice(0, 30).forEach((w) => console.warn("⚠", w));
if (!check.ok) { check.errors.forEach((e) => console.error("✖", e)); process.exit(1); }
console.log(`Fichier valide : ${check.verseCount} versets, ${check.books.length} livre(s)${check.complete ? "" : " — ÉDITION PARTIELLE"}.`);

const client = new ConvexHttpClient(url);
const api = anyApi.bibleAdmin;
const translationId = await client.mutation(api.createTranslation, {
  token, code: file.meta.code, name: file.meta.name, language: file.meta.language,
  license: { ...file.meta.license, commercialUseVerified: true, verifiedAt: Date.now() },
});

const BATCH = 300;
for (let i = 0; i < file.verses.length; i += BATCH) {
  await client.mutation(api.importVerses, { token, translationId, verses: file.verses.slice(i, i + BATCH) });
  process.stdout.write(`\rImport : ${Math.min(i + BATCH, file.verses.length)} / ${file.verses.length}`);
}
console.log("\nAudit livre par livre…");

const expected = new Map();
for (const x of file.verses) {
  const m = expected.get(x.bookId) ?? {};
  m[x.chapter] = (m[x.chapter] ?? 0) + 1;
  expected.set(x.bookId, m);
}
let mismatches = 0;
for (const [bookId, perChapter] of expected) {
  const audit = await client.query(api.auditBook, { token, translationId, bookId });
  const total = Object.values(perChapter).reduce((a, b) => a + b, 0);
  const same = audit.count === total && Object.entries(perChapter).every(([c, n]) => audit.perChapter[c] === n);
  if (!same) { mismatches += 1; console.error(`✖ ${bookId} : ${audit.count} versets en base, ${total} attendus.`); }
}
if (mismatches) { console.error("Audit échoué : l'édition N'EST PAS activée."); process.exit(2); }

if (embedRequested) {
  const chunks = chunkBibleVerses(file.verses);
  const model = process.env.AI_EMBEDDING_MODEL || "gemini-embedding-001";
  const batchSize = 20;
  console.log(`Vectorisation de ${chunks.length} segments (${model})…`);
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const embeddings = await embedTexts(batch.map((chunk) => chunk.text), {
      apiKey: embeddingApiKey,
      baseUrl: process.env.AI_EMBEDDING_BASE_URL || "https://generativelanguage.googleapis.com/v1beta",
      model,
      timeoutMs: Number(process.env.AI_TIMEOUT_MS || 30_000),
      taskType: "RETRIEVAL_DOCUMENT",
    });
    await client.mutation(api.importChunks, {
      token,
      translationId,
      chunks: batch.map((chunk, index) => ({ ...chunk, embedding: embeddings[index], embeddingModel: model })),
    });
    process.stdout.write(`\rSegments vectorisés : ${Math.min(i + batchSize, chunks.length)} / ${chunks.length}`);
  }
  console.log("");
}

await client.mutation(api.activateTranslation, { token, translationId, books: check.books, verseCount: check.verseCount, makeDefault: flags.includes("--default") });
console.log("Audit concordant. Édition activée.");

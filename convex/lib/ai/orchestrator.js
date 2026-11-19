import { AiError } from "./errors.js";
import { validateParams } from "./params.js";
import { GeneratedSermonSchema, generatedSermonJsonSchema } from "./sermonSchema.js";
import { SYSTEM_PROMPT, buildUserPrompt, buildRepairPrompt } from "./prompts.js";
import { extractJson, summarizeIssues } from "./parse.js";
import { parseReference, formatReference } from "../bible/reference.js";
import { buildSources, collectReferenceLabels } from "../bible/sources.js";

const MAX_INPUT_VERSES = 80;
const MAX_INPUT_CHARS = 8000;

/**
 * Pipeline : validation -> récupération -> contexte -> génération -> validation -> traçabilité.
 * deps = {
 *   provider: { name, model, generate({system, messages, jsonSchema, signal}) },
 *   retrievePassages: async (refs[]) => [{ ref, verses: [{verse,text}] | null }]   // aligné sur refs
 *   maxAttempts?, now?, signal?
 * }
 * Les textes bibliques des `sources` proviennent TOUJOURS de retrievePassages, jamais du modèle.
 */
export async function runSermonGeneration(rawParams, deps) {
  const now = deps.now ?? (() => Date.now());
  const startedAt = now();
  const warnings = [];

  const checked = validateParams(rawParams);
  if (!checked.ok) throw new AiError("validation", checked.message, { retryable: false });
  const params = checked.params;

  // 2. Récupération documentaire : passage principal fourni par l'utilisateur
  let inputSources = [];
  if (params.passage) {
    const ref = parseReference(params.passage).ref;
    const [found] = await deps.retrievePassages([ref]);
    if (found?.verses?.length) {
      let verses = found.verses;
      let chars = 0;
      const kept = [];
      for (const v of verses) {
        chars += v.text.length;
        if (kept.length >= MAX_INPUT_VERSES || chars > MAX_INPUT_CHARS) break;
        kept.push(v);
      }
      if (kept.length < verses.length) warnings.push({ code: "truncated_passage", message: "Le passage est long : seule une partie a été transmise au modèle." });
      inputSources = [{ reference: formatReference(ref), verses: kept }];
    } else {
      warnings.push({ code: "no_bible_text", message: "Le texte de ce passage n'est pas disponible dans la Bible intégrée : le sermon ne s'appuie que sur la référence." });
    }
  }

  // 3-5. Contexte, génération, validation (avec tentatives de réparation)
  const maxAttempts = deps.maxAttempts ?? 2;
  const messages = [{ role: "user", content: buildUserPrompt(params, inputSources) }];
  const jsonSchema = generatedSermonJsonSchema();
  let generated = null;
  let lastError = null;
  let usage = { promptTokens: 0, completionTokens: 0 };
  let attempts = 0;

  while (attempts < maxAttempts && !generated) {
    attempts += 1;
    let out;
    try {
      out = await deps.provider.generate({ system: SYSTEM_PROMPT, messages, jsonSchema, signal: deps.signal });
    } catch (error) {
      if (error instanceof AiError && error.retryable && error.code === "bad_response" && attempts < maxAttempts) { lastError = error; continue; }
      throw error;
    }
    usage = {
      promptTokens: (usage.promptTokens ?? 0) + (out.usage?.promptTokens ?? 0),
      completionTokens: (usage.completionTokens ?? 0) + (out.usage?.completionTokens ?? 0),
    };
    let issues;
    try {
      if (out.truncated) throw new AiError("bad_response", "Sortie tronquée (limite de longueur atteinte).");
      const parsed = GeneratedSermonSchema.safeParse(extractJson(out.text));
      if (parsed.success) { generated = parsed.data; break; }
      issues = summarizeIssues(parsed.error);
      lastError = new AiError("bad_response", `Réponse non conforme : ${issues}`);
    } catch (error) {
      if (!(error instanceof AiError)) throw error;
      issues = error.message;
      lastError = error;
    }
    messages.push({ role: "assistant", content: String(out.text).slice(0, 6000) }, { role: "user", content: buildRepairPrompt(issues) });
  }
  if (!generated) throw lastError ?? new AiError("bad_response", "Aucune réponse exploitable.");

  if (generated.points.length !== params.pointsCount) {
    warnings.push({ code: "points_count_mismatch", message: `Le modèle a produit ${generated.points.length} points au lieu de ${params.pointsCount} demandés.` });
  }

  // 6. Traçabilité : toutes les références citées, vérifiées contre la Bible intégrée
  const traced = await buildSources(collectReferenceLabels(generated, params.passage ? [params.passage] : []), deps.retrievePassages, { inputLabel: params.passage });
  const sources = traced.sources;
  warnings.push(...traced.warnings);

  return {
    content: { schemaVersion: 1, ...generated },
    sources,
    warnings,
    usage,
    attempts,
    provider: deps.provider.name,
    model: deps.provider.model,
    durationMs: now() - startedAt,
  };
}

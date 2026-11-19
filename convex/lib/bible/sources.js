import { parseReference, formatReference, referenceKey } from "./reference.js";

/**
 * Construit la liste de sources vérifiées à partir de libellés de références.
 * retrieve(refs[]) -> [{ ref, verses: [{verse,text}] | null }] (aligné sur refs)
 * Retourne { sources, warnings }. Les textes viennent TOUJOURS de retrieve.
 */
export async function buildSources(candidates, retrieve, { inputLabel = "" } = {}) {
  const sources = [];
  const warnings = [];
  const seen = new Set();
  const toFetch = [];
  for (const label of candidates.filter(Boolean)) {
    const parsed = parseReference(label);
    if (!parsed.ok) {
      const id = `invalid:${label}`;
      if (seen.has(id)) continue;
      seen.add(id);
      sources.push({ reference: label, key: null, status: "invalid", verses: null });
      warnings.push({ code: "invalid_reference", message: `Référence non reconnue : « ${label} ».` });
      continue;
    }
    const key = referenceKey(parsed.ref);
    if (seen.has(key)) continue;
    seen.add(key);
    const entry = { reference: formatReference(parsed.ref), key, status: "no_text", verses: null, origin: inputLabel && label === inputLabel ? "input" : "model" };
    sources.push(entry);
    toFetch.push({ entry, ref: parsed.ref });
  }
  if (toFetch.length) {
    const results = await retrieve(toFetch.map((t) => t.ref));
    toFetch.forEach((t, i) => {
      const verses = results[i]?.verses;
      if (verses?.length) { t.entry.verses = verses; t.entry.status = "verified"; }
    });
    const unverified = sources.filter((s) => s.status === "no_text").length;
    if (unverified) warnings.push({ code: "unverified_reference", message: `${unverified} référence(s) sans texte dans la Bible intégrée : à vérifier avant de prêcher.` });
  }
  return { sources, warnings };
}

/** Références citées par un sermon (passage principal, points, références complémentaires). */
export function collectReferenceLabels(content, extra = []) {
  return [...extra, content.mainPassage, ...content.points.map((p) => p.scriptureRef), ...content.relatedReferences].filter(Boolean);
}

import { AiError } from "./errors.js";

/** Extrait un objet JSON d'une sortie de modèle (balises <think>, clôtures ```json, texte autour). */
export function extractJson(raw) {
  if (typeof raw !== "string" || !raw.trim()) throw new AiError("bad_response", "Réponse vide.");
  let s = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end <= start) throw new AiError("bad_response", "Aucun objet JSON trouvé.");
  try {
    return JSON.parse(s.slice(start, end + 1));
  } catch {
    throw new AiError("bad_response", "JSON invalide ou tronqué.");
  }
}

/** Résumé compact des erreurs de validation, destiné au prompt de réparation. */
export function summarizeIssues(zodError, limit = 6) {
  return zodError.issues.slice(0, limit).map((i) => `${i.path.join(".") || "racine"} : ${i.message}`).join(" ; ");
}

import { SERMON_TYPES, TONES } from "../convex/lib/sermonTypes.js";

const norm = (s) => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function parseDurationMinutes(label) {
  const text = norm(label);
  const h = text.match(/(\d+)\s*h(?:eure)?s?\s*(\d+)?/);
  if (h) return Number(h[1]) * 60 + Number(h[2] ?? 0);
  const m = text.match(/(\d+)/);
  return m ? Number(m[1]) : 30;
}

/** Transforme les valeurs (libellés) du formulaire en paramètres du moteur de génération. */
export function buildGenerationParams(form) {
  const typeId = Object.entries(SERMON_TYPES).find(([, t]) => t.label === form.sermonType)?.[0] ?? "thematique";
  const tone = TONES.find((t) => norm(form.tone).startsWith(t.slice(0, 6))) ?? "enseignement";
  const detail = { concis: "concis", standard: "standard", detaille: "detaille" }[norm(form.detailLevel)] ?? "standard";
  const wanted = form.title?.trim() ? `Titre souhaité : ${form.title.trim()}\n` : "";
  return {
    theme: form.theme ?? "",
    passage: form.bibleReference ?? "",
    sermonType: typeId,
    audience: form.audience ?? "",
    durationMinutes: parseDurationMinutes(form.duration ?? "30 minutes"),
    tone,
    detailLevel: detail,
    pointsCount: Number(form.pointsCount) || 3,
    objective: form.objective ?? "",
    mainIdeas: form.mainIdeas ?? "",
    instructions: `${wanted}${form.instructions ?? ""}`.trim(),
  };
}

/** Message lisible à partir d'une erreur Convex (ConvexError) ou réseau. */
export function errorMessage(error) {
  const data = error?.data;
  if (data && typeof data === "object" && typeof data.message === "string") return data.message;
  if (typeof data === "string") return data;
  return "Une erreur inattendue est survenue. Réessayez dans un instant.";
}

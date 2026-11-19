import { z } from "zod";
import { AiError } from "./errors.js";
import { SECTION_SCHEMAS, POINT_SCHEMA } from "./sermonSchema.js";
import { SYSTEM_PROMPT, buildRepairPrompt } from "./prompts.js";
import { extractJson, summarizeIssues } from "./parse.js";

export const REGENERABLE_SECTIONS = ["introduction", "context", "conclusion", "applications", "reflectionQuestions"];
export const ACTIONS = {
  regenerate: "Réécris cette partie en gardant le même rôle dans le sermon.",
  expand: "Développe cette partie : plus de profondeur, sans répétition.",
  shorten: "Résume cette partie en gardant l'essentiel.",
  simplify: "Simplifie le langage : phrases courtes, vocabulaire courant.",
  tone: "Change le ton selon la consigne de l'utilisateur.",
  illustrate: "Ajoute une illustration pertinente (image ou exemple plausible, jamais un fait inventé présenté comme vrai).",
  custom: "Applique la consigne de l'utilisateur.",
};

export function sectionSchemaFor(path) {
  if (REGENERABLE_SECTIONS.includes(path)) return SECTION_SCHEMAS[path];
  if (/^points\.\d+$/.test(path)) return POINT_SCHEMA;
  throw new AiError("validation", "Cette partie ne peut pas être régénérée.", { retryable: false });
}

export function getSection(content, path) {
  const m = path.match(/^points\.(\d+)$/);
  if (m) {
    const point = content.points[Number(m[1])];
    if (!point) throw new AiError("validation", "Point inexistant.", { retryable: false });
    return point;
  }
  return content[path];
}

export function buildSectionPrompt({ content, path, action, instruction }) {
  const outline = content.points.map((p, i) => `${i + 1}. ${p.title}`).join("\n");
  return `Voici un sermon en préparation. Tu ne modifies qu'UNE partie.

Titre : ${content.title}
Passage : ${content.mainPassage || "(non précisé)"}
Idée centrale : ${content.centralIdea}
Plan :
${outline}

Partie à retravailler : « ${path} ».
Action : ${ACTIONS[action] ?? ACTIONS.custom}

<donnees_utilisateur>
Consigne : ${(instruction || "aucune").slice(0, 800)}
</donnees_utilisateur>

Contenu actuel de la partie (JSON) :
${JSON.stringify(getSection(content, path))}

Réponds par {"value": <nouvelle version de la partie>} avec exactement la même structure que le contenu actuel. Cite la Bible uniquement par références.`;
}

/** Propose une nouvelle version d'une partie. NE MODIFIE RIEN : l'utilisateur choisit d'appliquer ou non. */
export async function proposeSection({ content, path, action = "regenerate", instruction = "", provider, maxAttempts = 2, signal }) {
  const schema = sectionSchemaFor(path);
  const wrapper = z.object({ value: schema });
  const messages = [{ role: "user", content: buildSectionPrompt({ content, path, action, instruction }) }];
  const jsonSchema = z.toJSONSchema(wrapper, { io: "input" });
  let last = null;
  let usage = { promptTokens: 0, completionTokens: 0 };
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const out = await provider.generate({ system: SYSTEM_PROMPT, messages, jsonSchema, signal });
    usage = { promptTokens: usage.promptTokens + (out.usage?.promptTokens ?? 0), completionTokens: usage.completionTokens + (out.usage?.completionTokens ?? 0) };
    let issues;
    try {
      if (out.truncated) throw new AiError("bad_response", "Sortie tronquée.");
      const parsed = wrapper.safeParse(extractJson(out.text));
      if (parsed.success) return { value: parsed.data.value, usage, attempts: attempt };
      issues = summarizeIssues(parsed.error);
    } catch (error) {
      if (!(error instanceof AiError)) throw error;
      issues = error.message;
    }
    last = new AiError("bad_response", `Réponse non conforme : ${issues}`);
    messages.push({ role: "assistant", content: String(out.text).slice(0, 6000) }, { role: "user", content: buildRepairPrompt(issues) });
  }
  throw last;
}

import { z } from "zod";
import { SERMON_TYPE_IDS, TONES, DETAIL_LEVELS } from "../sermonTypes.js";
import { parseReference } from "../bible/reference.js";

// Supprime les caractères de contrôle (sauf retours à la ligne) : défense de base avant injection dans un prompt.
const clean = (max) =>
  z.string().transform((s) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim()).pipe(z.string().max(max));

export const GenerationParamsSchema = z
  .object({
    theme: clean(300).default(""),
    passage: clean(80).default(""),
    sermonType: z.enum(SERMON_TYPE_IDS).default("thematique"),
    audience: clean(200).default("Assemblée locale"),
    durationMinutes: z.number().int().min(5).max(120).default(30),
    tone: z.enum(TONES).default("enseignement"),
    detailLevel: z.enum(DETAIL_LEVELS).default("standard"),
    pointsCount: z.number().int().min(1).max(7).default(3),
    objective: clean(500).default(""),
    mainIdeas: clean(1000).default(""),
    instructions: clean(1500).default(""),
    translationId: z.string().max(64).optional(),
    language: z.enum(["fr"]).default("fr"),
  })
  .superRefine((p, ctx) => {
    if (!p.theme && !p.passage) {
      ctx.addIssue({ code: "custom", path: ["theme"], message: "Indiquez au moins un thème ou un passage biblique." });
    }
    if (p.theme && p.theme.length < 3) ctx.addIssue({ code: "custom", path: ["theme"], message: "Le thème est trop court." });
    if (p.passage) {
      const r = parseReference(p.passage);
      if (!r.ok) ctx.addIssue({ code: "custom", path: ["passage"], message: r.error });
    }
  });

export function validateParams(input) {
  const r = GenerationParamsSchema.safeParse(input ?? {});
  if (r.success) return { ok: true, params: r.data };
  const fields = {};
  for (const issue of r.error.issues) fields[issue.path.join(".") || "_"] = issue.message;
  return { ok: false, fields, message: Object.values(fields)[0] ?? "Paramètres invalides." };
}

import { z } from "zod";

const text = (max) => z.string().trim().min(1).max(max);
const paragraphs = (min, max) => z.array(text(4000)).min(min).max(max);

/** Ce que le modèle doit produire. Les versets cités sont des RÉFÉRENCES ; le texte vient de la base. */
export const GeneratedSermonSchema = z.object({
  title: text(200),
  theme: text(300),
  mainPassage: z.string().trim().max(80).default(""),
  objective: text(600),
  centralIdea: text(600),
  introduction: z.object({ paragraphs: paragraphs(1, 4) }),
  context: z.object({ paragraphs: paragraphs(1, 4) }),
  points: z
    .array(
      z.object({
        title: text(250),
        scriptureRef: z.string().trim().max(80).default(""),
        paragraphs: paragraphs(1, 6),
        keyPoint: text(500),
        illustration: z.string().trim().max(1500).default(""),
        application: z.string().trim().max(1500).default(""),
        transition: z.string().trim().max(600).default(""),
      })
    )
    .min(1)
    .max(8),
  applications: z.array(z.object({ title: text(200), text: text(1200) })).min(1).max(8),
  conclusion: z.object({ paragraphs: paragraphs(1, 3), call: z.string().trim().max(800).default("") }),
  reflectionQuestions: z.array(text(400)).max(10).default([]),
  relatedReferences: z.array(z.string().trim().min(1).max(80)).max(12).default([]),
});

/** JSON Schema transmis à Ollama (paramètre `format`) pour contraindre la sortie. */
export const generatedSermonJsonSchema = () => z.toJSONSchema(GeneratedSermonSchema, { io: "input" });

/** Schémas des sections modifiables (éditeur) : mêmes contraintes que la génération. */
export const SECTION_SCHEMAS = {
  title: GeneratedSermonSchema.shape.title,
  theme: GeneratedSermonSchema.shape.theme,
  objective: GeneratedSermonSchema.shape.objective,
  centralIdea: GeneratedSermonSchema.shape.centralIdea,
  introduction: GeneratedSermonSchema.shape.introduction,
  context: GeneratedSermonSchema.shape.context,
  applications: GeneratedSermonSchema.shape.applications,
  conclusion: GeneratedSermonSchema.shape.conclusion,
  reflectionQuestions: GeneratedSermonSchema.shape.reflectionQuestions,
  relatedReferences: GeneratedSermonSchema.shape.relatedReferences,
};
export const POINT_SCHEMA = GeneratedSermonSchema.shape.points.element;

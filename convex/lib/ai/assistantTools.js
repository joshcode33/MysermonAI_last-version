import { z } from "zod";
import { extractJson } from "./parse.js";
import { AiError } from "./errors.js";
import { GeneratedSermonSchema } from "./sermonSchema.js";

const outlineSchema = z.object({
  title: z.string().trim().min(1).max(200),
  centralIdea: z.string().trim().min(1).max(600),
  points: z.array(z.object({
    title: z.string().trim().min(1).max(250),
    scriptureRef: z.string().trim().max(80).default(""),
    keyPoint: z.string().trim().min(1).max(500),
  })).min(1).max(7),
});

const sectionSchema = z.object({ content: z.string().trim().min(1).max(6000) });

function structuredRequest(provider, system, prompt, schema) {
  return provider.generate({
    system,
    messages: [{ role: "user", content: prompt }],
    jsonSchema: z.toJSONSchema(schema, { io: "input" }),
  }).then((response) => {
    if (response.truncated) throw new AiError("bad_response", "Réponse structurée tronquée.");
    try {
      return schema.parse(extractJson(response.text));
    } catch {
      throw new AiError("bad_response", "La sortie de l'outil ne respecte pas le schéma attendu.");
    }
  });
}

export function createAssistantTools(implementations) {
  return [
    {
      name: "searchBible",
      description: "Recherche lexicale et sémantique dans les éditions bibliques actives; les résultats indiquent la méthode et l'édition.",
      parameters: z.toJSONSchema(z.object({ query: z.string().trim().min(2).max(200) }), { io: "input" }),
      schema: z.object({ query: z.string().trim().min(2).max(200) }),
      execute: async (args) => {
        const [lexical, semantic] = await Promise.all([
          implementations.searchBible(args),
          implementations.semanticSearchBible(args),
        ]);
        return {
          lexical,
          semantic,
          sources: [...(semantic.sources ?? [])],
          references: [
            lexical.reference,
            ...(lexical.results ?? []).map((result) => result.reference),
            ...(semantic.results ?? []).map((result) => result.reference),
          ].filter(Boolean),
          warnings: [...(lexical.warnings ?? []), ...(semantic.warnings ?? [])],
        };
      },
    },
    {
      name: "getPassage",
      description: "Récupère les versets exacts d'une référence dans l'édition active.",
      parameters: z.toJSONSchema(z.object({ reference: z.string().trim().min(1).max(80) }), { io: "input" }),
      schema: z.object({ reference: z.string().trim().min(1).max(80) }),
      execute: implementations.getPassage,
    },
    {
      name: "findRelatedVerses",
      description: "Recherche lexicalement des versets contenant les termes fournis. Cette recherche ne constitue pas une référence croisée théologique.",
      parameters: z.toJSONSchema(z.object({ query: z.string().trim().min(2).max(200) }), { io: "input" }),
      schema: z.object({ query: z.string().trim().min(2).max(200) }),
      execute: implementations.findRelatedVerses,
    },
    {
      name: "analyzeContext",
      description: "Récupère le passage et les versets qui l'entourent dans le même chapitre; aucune source historique ou lexicale externe n'est supposée.",
      parameters: z.toJSONSchema(z.object({ reference: z.string().trim().min(1).max(80) }), { io: "input" }),
      schema: z.object({ reference: z.string().trim().min(1).max(80) }),
      execute: implementations.analyzeContext,
    },
    {
      name: "buildSermonOutline",
      description: "Produit un plan de sermon validé à partir d'un thème et, le cas échéant, de versets vérifiés.",
      parameters: z.toJSONSchema(z.object({ theme: z.string().trim().min(3).max(300), passage: z.string().trim().max(80).optional() }), { io: "input" }),
      schema: z.object({ theme: z.string().trim().min(3).max(300), passage: z.string().trim().max(80).optional() }),
      execute: async ({ theme, passage }) => {
        const source = passage ? await implementations.getPassage({ reference: passage }) : null;
        const result = await structuredRequest(
          implementations.provider,
          "Tu aides à préparer des prédications. Ne cite aucun texte biblique de mémoire. Distingue observation et application. Réponds uniquement en JSON.",
          `Thème : ${theme}\nPassage vérifié : ${JSON.stringify(source)}\nPropose un titre, une idée centrale et 1 à 7 points fondés sur les sources disponibles. Ne crée pas de références absentes.`,
          outlineSchema
        );
        return { ...result, sources: source?.sources ?? [], warnings: source?.warnings ?? [] };
      },
    },
    {
      name: "generateSermonSection",
      description: "Rédige une seule section pastorale structurée à partir du contexte et de la consigne.",
      parameters: z.toJSONSchema(z.object({
        section: z.enum(["introduction", "context", "point", "application", "conclusion"]),
        instruction: z.string().trim().min(3).max(1500),
        context: z.string().trim().max(5000).default(""),
      }), { io: "input" }),
      schema: z.object({
        section: z.enum(["introduction", "context", "point", "application", "conclusion"]),
        instruction: z.string().trim().min(3).max(1500),
        context: z.string().trim().max(5000).default(""),
      }),
      execute: ({ section, instruction, context }) => structuredRequest(
        implementations.provider,
        "Tu es un assistant de rédaction pastorale. Reste prudent et fidèle aux sources fournies. N'invente ni fait ni citation biblique.",
        `Section : ${section}\nConsigne : ${instruction}\nContexte documentaire : ${context}\nRéponds uniquement avec un objet JSON contenant content.`,
        sectionSchema
      ),
    },
    {
      name: "verifyReferences",
      description: "Valide les références bibliques et retourne les textes uniquement s'ils existent dans la Bible intégrée.",
      parameters: z.toJSONSchema(z.object({ references: z.array(z.string().trim().min(1).max(80)).min(1).max(12) }), { io: "input" }),
      schema: z.object({ references: z.array(z.string().trim().min(1).max(80)).min(1).max(12) }),
      execute: implementations.verifyReferences,
    },
    {
      name: "saveSermon",
      description: "Enregistre un sermon dans la bibliothèque personnelle uniquement si l'utilisateur l'a explicitement demandé.",
      parameters: z.toJSONSchema(z.object({ title: z.string().trim().min(1).max(200), content: GeneratedSermonSchema }), { io: "input" }),
      schema: z.object({ title: z.string().trim().min(1).max(200), content: GeneratedSermonSchema }),
      execute: implementations.saveSermon,
    },
  ];
}

// Modèles de départ : des structures de travail, pas des garanties de justesse théologique.
export const SERMON_TYPES = {
  expositif: { label: "Sermon expositif", guidance: "Suis l'ordre du passage verset par verset ; chaque point doit découler directement du texte." },
  thematique: { label: "Sermon thématique", guidance: "Développe un thème en t'appuyant sur plusieurs passages ; indique pour chaque point le passage qui le fonde." },
  textuel: { label: "Sermon textuel", guidance: "Prends les divisions naturelles d'un court passage comme points principaux." },
  doctrinal: { label: "Sermon doctrinal", guidance: "Présente un enseignement doctrinal avec clarté ; distingue ce que le texte affirme des interprétations débattues." },
  evangelistique: { label: "Sermon évangélique", guidance: "Parle simplement à des personnes qui découvrent la foi ; termine par une invitation claire mais respectueuse." },
  enseignement: { label: "Sermon d'enseignement", guidance: "Priorité à la compréhension : explique le contexte, définis les termes, donne des exemples." },
  motivation: { label: "Message de motivation spirituelle", guidance: "Ton encourageant ; ancre chaque encouragement dans le texte biblique plutôt que dans des slogans." },
  meditation: { label: "Méditation", guidance: "Texte court et contemplatif, centré sur une idée ; peu de points, beaucoup de pistes de réflexion." },
  etude_biblique: { label: "Étude biblique", guidance: "Alterne observation, interprétation et application ; inclus des questions d'étude pour le groupe." },
  groupe: { label: "Enseignement pour un groupe", guidance: "Prévois des temps d'échange et des questions de discussion ouvertes." },
  jeunes: { label: "Message pour les jeunes", guidance: "Langage actuel et concret, exemples de la vie quotidienne, sans condescendance." },
  enfants: { label: "Message pour les enfants", guidance: "Phrases courtes, vocabulaire simple, une seule idée centrale, une histoire ou image par point." },
  plan_court: { label: "Plan de prédication court", guidance: "Fournis un plan synthétique : idées clés en une ou deux phrases par partie, sans longs développements." },
};
export const SERMON_TYPE_IDS = Object.keys(SERMON_TYPES);

export const TONES = ["enseignement", "exhortation", "encouragement", "evangelisation", "contemplatif", "solennel"];
export const DETAIL_LEVELS = ["concis", "standard", "detaille"];

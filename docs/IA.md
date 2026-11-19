# Moteur IA et fournisseur Gemini

## Contrat fournisseur
Les actions Convex appellent un contrat commun (`generate`) avec un prompt système, un historique de messages, un schéma JSON optionnel et des définitions d'outils. La réponse normalisée contient le texte, les appels d'outils, l'état de troncature et l'usage. Les secrets ne sont lus que côté serveur.

Gemini est le fournisseur par défaut (`AI_PROVIDER=gemini`, modèle `gemini-2.5-flash`). Ollama et `openai-compatible` restent disponibles par configuration et implémentent également les appels d'outils. L'endpoint OpenAI-compatible sert notamment vLLM, LM Studio ou un proxy compatible.

## Variables d'environnement
Copiez `.env.example` vers `.env.local` pour le frontend; définissez aussi les variables sensibles **dans le déploiement Convex** avec `npx convex env set GEMINI_API_KEY <clé>`. Ne mettez jamais de clé dans une variable `NEXT_PUBLIC_*`. `AI_PROVIDER`, `AI_MODEL`, les délais et limites peuvent être définis séparément en local et sur chaque déploiement Convex.

Pour Ollama, choisissez `AI_PROVIDER=ollama` et configurez `OLLAMA_BASE_URL` / `OLLAMA_MODEL`. Un Convex cloud ne peut pas joindre `localhost`; il faut un backend local ou une URL HTTPS accessible. Ne publiez pas directement le port Ollama. Pour OpenAI-compatible, choisissez `AI_PROVIDER=openai-compatible` et configurez `OPENAI_COMPATIBLE_BASE_URL`, `OPENAI_COMPATIBLE_MODEL` et, si nécessaire, `OPENAI_COMPATIBLE_API_KEY`. Les variables communes `AI_BASE_URL`, `AI_MODEL` et `AI_API_KEY` restent prioritaires lorsqu'elles sont définies.

## Évaluation des modèles
Gemini n'a pas été appelé depuis cet environnement; aucun résultat de production ou qualité de modèle n'est affirmé. La clé doit être configurée manuellement avant un appel réel. Ollama reste disponible comme alternative locale ou hébergée.

## Architecture
`generation.js` conserve le pipeline existant de sermon. `assistant.js` utilise `lib/ai/assistant.js` pour l'orchestration conversationnelle, l'exécution bornée des outils et la validation Zod de la réponse. Les références sont vérifiées dans la Bible intégrée; les textes présentés par les outils proviennent des données importées, jamais d'un texte de mémoire du modèle.

L'Agent Component Convex (`@convex-dev/agent`) stocke durablement les conversations. L'app associe chaque fil à son propriétaire; les lectures et écritures applicatives contrôlent cette association côté serveur.

## Recherche sémantique
La recherche sémantique utilise l'API d'embeddings Gemini (`gemini-embedding-001`, 768 dimensions) et l'index vectoriel Convex. Pour l'activer, configurer `GEMINI_API_KEY` ou `AI_EMBEDDING_API_KEY` dans Convex. Aucun versement n'est préchargé et aucun appel distant n'est exécuté lors des tests unitaires.

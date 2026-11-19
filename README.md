# MySermon AI

Plateforme d'aide à la préparation de prédications : Next.js 16 (App Router, JSX) + Convex (base, auth, logique serveur) + Ollama (IA).

## Démarrage
```bash
npm install
npx convex dev            # crée le déploiement, génère convex/_generated, définit les variables
npx @convex-dev/auth      # configure l'authentification (clés JWT)
cp .env.example .env.local   # renseigner NEXT_PUBLIC_CONVEX_URL
npm run dev
npm test                  # tests de la logique métier (sans réseau)
npm run lint
```
Configuration IA : `docs/IA.md`. Bible : `docs/BIBLE.md`. État d'avancement honnête : `docs/STATUS.md`.

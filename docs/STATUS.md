# État d'avancement (honnête)

Légende : ✅ vérifié automatiquement · ⚠️ écrit mais NON exécuté · ❌ non fait

## Vérifié (33 tests `npm test`, ESLint propre, syntaxe JSX/JS valide)
- ✅ Catalogue des 66 livres, analyse/formatage des références (variantes, abréviations, plages, livres à 1 chapitre)
- ✅ Couche IA : paramètres, schéma Zod, extraction/réparation JSON, tentatives, erreurs/délais, fournisseurs Ollama et OpenAI-compatible (fetch simulé), configuration
- ✅ Régénération d'une partie (proposition non destructive), traçabilité (`buildSources`), lecture de passages (base simulée)
- ✅ Quotas/anti-rafale, rôles d'accès, validation du fichier d'import biblique, mapping du formulaire

## Écrit mais jamais exécuté (pas d'`npm install`, Convex ni `next build` possibles dans mon environnement)
- ⚠️ Backend Convex : schéma, auth e-mail/mot de passe, profils, Bible (lecture, recherche, favoris, notes, progression), sermons (édition par section, versions, restauration, suppression douce, notes de prédication), génération atomique avec quotas, `suggestSection`, purge des données
- ⚠️ Pages : accueil, connexion, inscription, tableau de bord, Bible (lecteur, recherche, favoris, notes, taille du texte), création, sermon (lecture, édition section par section, ajout/suppression/réordonnancement des points, assistant IA par section, versions, statut), mode prédication (plein écran, taille, navigation, notes), profil, impression/PDF navigateur
- ⚠️ `proxy.js` (Next 16 + `convexAuthNextjsMiddleware`) : compatibilité à confirmer au premier `next dev`
- ⚠️ Import biblique (script + fonctions admin protégées par `BIBLE_IMPORT_TOKEN`)

## Non fait
- ❌ Aucune édition biblique importée (vous devez fournir une source dont la licence est vérifiée)
- ❌ Dérivés d'un sermon (résumé, WhatsApp, Facebook, newsletter, diapositives), interface d'espaces de travail/équipes (les règles d'accès existent côté serveur), facturation/paiement, i18n (lingala/swahili), évaluation automatique de la qualité des modèles, tests d'interface (Playwright), recherche sémantique, actions IA directement depuis le lecteur biblique (seul « Préparer un sermon » depuis un passage existe)
- ❌ Récupération de mot de passe par e-mail (nécessite un fournisseur d'e-mails)
- ❌ Suppression des enregistrements d'authentification dans `purgeMyData` (données applicatives seulement)
- ❌ Export PDF dédié : l'impression du navigateur (« Enregistrer en PDF ») est utilisée
- ❌ Migration de données Supabase (aucun accès ; ancien schéma dans `docs/legacy/`)

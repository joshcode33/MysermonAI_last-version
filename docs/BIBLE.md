# Bible intégrée

Aucun texte biblique n'est livré avec ce dépôt. Le lecteur affiche un état vide tant qu'aucune édition n'est importée.

## Choix d'une édition (à faire par vous)
Vérifiez pour chaque édition : statut juridique dans les territoires visés, conditions de stockage/affichage, besoin d'une licence commerciale et droit d'indexer le texte pour la recherche sémantique. Les éditions révisées récentes sont protégées ; des éditions anciennes peuvent être dans le domaine public, mais **vérifiez la source exacte** et l'édition (révision) avant import. Consignez la provenance dans `meta.license`. Aucun mécanisme logiciel ne remplace un avis juridique.

## Format du fichier d'import
```json
{
  "meta": { "code": "XXX", "name": "Nom de l'édition", "language": "fr",
    "license": { "status": "public_domain|licensed|demo", "holder": "...", "source": "...", "url": "...", "notes": "...", "verifiedBy": "votre nom", "commercialUseVerified": true } },
  "verses": [ { "bookId": "JHN", "chapter": 3, "verse": 16, "text": "..." } ]
}
```
Codes de livres : voir `convex/lib/bible/books.js` (GEN, EXO, … REV).
`commercialUseVerified` est une attestation explicite et obligatoire pour l'import. Ne la définissez à `true` qu'après vérification documentée des droits d'utilisation commerciale, de stockage, d'affichage et d'indexation de l'édition concernée.

## Import
`npm run bible:import -- edition.json --default` (variables : `CONVEX_URL`, `BIBLE_IMPORT_TOKEN`). Le script valide le fichier, importe par lots, **audite la base livre par livre** et n'active l'édition que si tout concorde. Une édition partielle est signalée comme telle.

Pour préparer l'index vectoriel en même temps que l'import : `npm run bible:import -- edition.json --default --embed`. Il faut alors configurer `GEMINI_API_KEY` (ou `AI_EMBEDDING_API_KEY`). Les embeddings sont calculés à l'exécution; aucun corpus ou embedding prérempli n'est livré dans le dépôt. L'index a 768 dimensions (`gemini-embedding-001`).

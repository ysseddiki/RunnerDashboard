# Design: coach-v2-and-session-suggest

## Coach v2

`POST /api/coach/advise` demande à Ollama un **JSON unique** :

```json
{
  "summary": "2–4 phrases",
  "plan": [
    {
      "date": "YYYY-MM-DD",
      "session_type": "ef|seuil|...",
      "title": "court",
      "details": "consigne",
      "target_pace": "5:10/km ou null",
      "duration_or_distance": "45 min / 10 km"
    }
  ],
  "markdown": "analyse détaillée en markdown FR"
}
```

Parsing robuste : extraire le premier objet `{...}` ; si échec, `summary` = début du texte, `plan` = [], `markdown` = brut.

UI Coach :
1. Bandeau synthèse
2. Grille / liste calendrier du plan
3. Corps markdown (`react-markdown` + GFM)

## Suggestion de type

1. **Règles** : comparer allure sortie vs allure 10k estimée (facteurs TRAINING_FACTORS), distance, D+, nom Strava (mots-clés).
2. **IA optionnelle** (`use_ai=true`) : Ollama départage avec ids autorisés seulement.
3. Endpoints :
   - `POST /api/activities/{id}/suggest-session-type`
   - `POST /api/activities/suggest-session-types` (batch, untagged only, limit)
4. UI : bouton « Suggérer » → propose → utilisateur confirme (PATCH existant).

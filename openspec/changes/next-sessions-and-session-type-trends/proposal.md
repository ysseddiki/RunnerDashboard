## Why

L’athlète voit forme (ATL/CTL/TSB), adhérence au plan et KPIs par séance, mais pas encore **quoi faire ensuite** ni **si chaque type de séance progresse**. Sans prescriptions déterministes ni tendances par `session_type`, le coach LLM invente ou reste vague, et la question « je suis plus performant ? » n’a pas de réponse structurée.

## What Changes

- Ajouter un moteur **`next_sessions`** : 3–7 prochaines séances prescrites (type, durée/distance, allure cible, rationale FR) à partir de forme, adhérence, volumes easy/qualité, allures d’entraînement et plan existant.
- Exposer **tendances longitudinales par `session_type`** (allure, FC, decoupling, régularité) sur fenêtres 28j / 84j.
- Endpoints API + UI (Home / Coach / Predictions ou section dédiée) ; enrichir le contexte coach avec ces faits (ne pas inventer).
- Pas de **BREAKING** : champs et endpoints nouveaux ; plan LLM existant conservé (complété, pas remplacé).

## Non-goals

- Remplacer le plan coach LLM ou éditer manuellement les matchs plan↔activité
- HRV / sommeil / VDOT Daniels / TSS / puissance NP
- Prescription multi-athlète ou export calendrier (ICS)
- Correction manuelle des intervalles détectés

## Capabilities

### New Capabilities

- `next-sessions`: prescriptions déterministes des prochaines séances + API/UI
- `session-type-trends`: séries et deltas de performance agrégés par type de séance

### Modified Capabilities

- `analytics`: overview enrichie (aperçu next_sessions + tendances clés)
- `coach`: contexte + prompt avec next_sessions et tendances (faits seulement)
- `ui`: blocs Home/Coach/Predictions pour prescriptions et tendances par type
- `predictions`: réutiliser les allures d’entraînement comme cibles de prescription (pas de nouvelle formule Riegel)

## Impact

- API : nouveaux services `next_sessions.py`, `session_type_trends.py` ; routers analytics/coach ; tests
- Web : composants prescription + charts/listes tendances ; pages Home et Coach (évent. Predictions)
- Coach Ollama : payload contexte élargi ; front n’appelle jamais Ollama
- Pas de migration DB obligatoire (calcul on-read V1)

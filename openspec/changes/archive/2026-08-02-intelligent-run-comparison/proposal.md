## Why

L’utilisateur voit déjà des tendances agrégées (28 j., types de séance) mais ne peut pas comparer **deux sorties concrètes** pour comprendre s’il a progressé. Une comparaison basique (deux colonnes de chiffres) ignore le contexte (délai entre séances, type, distance, météo, charge). Besoin d’une lecture intelligente, en français, avec le **temps écoulé entre les deux exercices** en introduction.

## What Changes

- Nouvelle capacité de **comparaison intelligente de deux activités** (A = plus ancienne, B = plus récente)
- Introduction de la comparaison : **intervalle calendaire** entre les deux (jours / semaines / mois, libellé FR)
- Analyse contextualisée : allure, FC, D+, volume, indicateurs `features_json` (découplage, régularité, zones) quand disponibles ; verdicts `mieux` / `stable` / `moins_bon` / `indetermine` avec caveats (distances très différentes, types différents, météo)
- UX : sélection de 2 sorties (liste Activités et/ou page dédiée) + synthèse narrative FR (déterministe, pas LLM)
- Endpoint API dédié (métier côté FastAPI) ; le front n’embarque pas la logique métier

## Non-goals

- Comparer plus de 2 sorties à la fois
- Overlay GPS / sync streams km-par-km (V2 éventuelle)
- Génération de texte par Ollama pour la comparaison
- Comparaison cross-athlète

## Capabilities

### New Capabilities

- `run-comparison`: comparaison intelligente de deux activités running (intro délai, deltas contextualisés, verdicts FR)

### Modified Capabilities

- `ui`: navigation / entrée UX pour lancer une comparaison depuis Activités

## Impact

- `apps/api` : nouveau service + route `POST`/`GET` compare
- `apps/web` : page ou panneau Comparaison, sélection 2 IDs, affichage synthèse
- Réutilise `ActivityDetail` / `features_json` / sémantique déjà présente dans `session_type_trends`
- Pas de nouvelles dépendances lourdes

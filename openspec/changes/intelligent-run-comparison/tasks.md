## 1. API — service de comparaison

- [x] 1.1 Créer `services/run_comparison.py` : ordonner A/B, calculer `days_between` + `interval_label_fr`
- [x] 1.2 Calculer deltas contextualisés (allure, FC, D+, distance, cadence, decoupling/cv si dispo) + caveats
- [x] 1.3 Produire `overall_direction` + `overall_summary_fr` / `intro_fr` (déterministe)
- [x] 1.4 Exposer `POST /api/activities/compare` (auth, validation exactement 2 ids, ownership)
- [x] 1.5 Tests unitaires des règles (même type / distances ≠ / types ≠ / même jour)

## 2. Web — sélection et page

- [x] 2.1 Types TS + appel API compare
- [x] 2.2 Bouton « Comparer » sur `ActivitiesPage` si exactement 2 sélectionnées → `/compare?a=&b=`
- [x] 2.3 Page `ComparePage` : intro délai, verdict, métriques, caveats, liens détail
- [x] 2.4 Route + états loading / erreur / empty FR alignés design system

## 3. Qualité

- [x] 3.1 Smoke build web + smoke API (compare happy path)
- [x] 3.2 Passe visuelle light/dark de la page comparaison

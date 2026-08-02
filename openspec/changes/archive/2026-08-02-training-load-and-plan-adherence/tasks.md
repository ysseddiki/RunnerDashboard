## 1. Training load (API)

- [x] 1.1 Créer `services/training_load.py` : daily TRIMP, EMA ATL/CTL, TSB, statut forme
- [x] 1.2 Snapshot `form` + série (fenêtre days, min 14 jours TRIMP pour `available`)
- [x] 1.3 Endpoint `GET /api/analytics/load-series`
- [x] 1.4 Enrichir `build_overview` avec objet `form` (sans casser `load` ACR)
- [x] 1.5 Tests unitaires EMA / seuils statut / indisponibilité

## 2. Plan adherence (API)

- [x] 2.1 Créer `services/plan_adherence.py` : matching ±1j, score type/volume, activity unique
- [x] 2.2 Score `adherence_pct` + compteurs matched/missed/upcoming
- [x] 2.3 Enrichir `GET /api/coach/plan` (ou endpoint dédié) avec `adherence`
- [x] 2.4 Tests unitaires matching (match, miss, upcoming, collision)

## 3. Coach contexte

- [x] 3.1 Injecter `form` + `adherence` dans `build_coach_context`
- [x] 3.2 Rappeler dans le prompt system de ne pas inventer ATL/CTL/TSB ni % adhérence

## 4. UI web

- [x] 4.1 Types TS pour `form`, load-series, adherence
- [x] 4.2 Composant `FormChart` (ECharts CTL/ATL/TSB) + badge statut
- [x] 4.3 Intégrer courbe/statut sur HomePage (état vide FR)
- [x] 4.4 Afficher statuts plan vs réalisé + % adhérence sur CoachPage
- [x] 4.5 Styles CSS distincts matched / missed / upcoming

## 5. Vérification

- [x] 5.1 Smoke overview + load-series avec activités TRIMP
- [x] 5.2 Smoke Coach plan enrichi (matched/missed)
- [x] 5.3 README : mention forme ATL/CTL/TSB + adhérence plan

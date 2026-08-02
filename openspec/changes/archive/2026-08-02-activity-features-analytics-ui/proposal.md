## Why

Les streams Strava sont stockés et affichés bruts, mais le produit n’en tire pas de KPIs métier (zones, splits, intervalles, charge). Overview et coach mélangent donc des séances incomparables et donnent un feedback générique. Il faut une couche de features déterministes par activité, des analytics filtrées/corrélées, et une UI détail adaptée au `session_type`.

## What Changes

- Extraire et persister des **features** déterministes depuis streams + profil (splits, time-in-zone, decoupling, TRIMP, détection d’intervalles selon le type).
- Recalculer les features au Sync (et via Admin batch) ; exposer via API détail / analytics.
- Restreindre les agrégats overview/prédictions au **pool running** (exclure marche/randonnée Apple des tendances d’allure).
- Enrichir l’overview : charge physiologique (TRIMP / ACR) en complément du spike volume ; tendances volume qualité vs EF.
- Adapter la page détail activité : templates de graphes/KPIs par `session_type` + lecture déterministe avant coach IA.
- Brancher le contexte coach activité sur `features_json` (sans inventer de métriques).

## Non-goals

- Ingest Garmin / FIT / CSV / HealthKit live.
- TSS TrainingPeaks, puissance NP/IF complète, VDOT Daniels.
- Sleep / HRV / récupération Apple.
- Multi-sport (vélo, natation).
- Refonte complète Home / Predictions (hors overlays charge et filtres).
- Warehouse / Spark ; le feature store reste Postgres in-process.

## Capabilities

### New Capabilities

- `activity-features`: extraction, persistance et API des features par activité (transverses + spécifiques au `session_type`).

### Modified Capabilities

- `analytics`: filtres d’éligibilité running, charge TRIMP/ACR, agrégats corrélés (qualité vs EF), fiabilité des indicateurs.
- `ui`: détail activité par template de séance (KPIs, overlays graphes, splits/reps, états N/A explicites).

## Impact

- **API** : `apps/api` — nouveau service features, hooks Sync/Admin, schémas Pydantic, endpoints détail/analytics ; léger impact coach activité (contexte enrichi).
- **DB** : colonne/table features sur activités ; éventuel job recompute.
- **Web** : `ActivityDetailPage`, `StreamCharts`, composants KPIs par type ; Home évolution (charge).
- **Specs** : nouvelle `activity-features` ; deltas `analytics` et `ui`.

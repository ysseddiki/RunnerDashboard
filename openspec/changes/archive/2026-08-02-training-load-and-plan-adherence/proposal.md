## Why

Les features (TRIMP) et le plan coach existent, mais la charge n’est qu’un snapshot ACR et le plan n’est jamais croisé avec les sorties réelles. Pour piloter la suite d’entraînement, il faut une **forme continue** (ATL/CTL/TSB) et une **adhérence plan vs réalisé**.

## What Changes

- Calculer et exposer une série journalière de charge : TRIMP/jour, **ATL** (~7j), **CTL** (~42j), **TSB** (CTL−ATL), avec états N/A si TRIMP insuffisant.
- Enrichir l’overview analytics / Home : courbe de forme + lecture (fraîcheur / fatigue / surcharge).
- Croiser le `CoachPlan` persisté avec les activités running : matching date ± fenêtre + `session_type` + volume.
- Exposer un score d’adhérence (semaine / horizon du plan) : prévu | fait | manqué | écart type/intensité.
- Afficher sur Coach (et résumé Home) le tableau plan vs réalisé + alertes FR déterministes.
- Injecter ATL/CTL/TSB + adhérence dans le contexte coach (faits seulement ; LLM n’invente pas les chiffres).

## Non-goals

- Prescription `next_sessions` (change suivant).
- Sleep / HRV / TSS TrainingPeaks / Banister complet.
- Édition manuelle des matchs plan↔activité (V1 = matching auto + confiance).
- Multi-athlète, export coach externe.
- Remplacer le TRIMP Edwards / ACR déjà livrés (on les complète).

## Capabilities

### New Capabilities

- `training-load`: série temporelle de charge (TRIMP journalier, ATL, CTL, TSB) et API/lecture de forme.
- `plan-adherence`: matching plan coach ↔ activités, scores d’adhérence, écarts et alertes.

### Modified Capabilities

- `analytics`: overview enrichie (forme ATL/CTL/TSB + lien charge existante).
- `ui`: Home (courbe forme) + Coach (plan vs réalisé).
- `coach`: contexte enrichi avec load/forme et adhérence pour advise/plan.

## Impact

- **API** : nouveaux services `training_load.py`, `plan_adherence.py` ; endpoints overview / coach ; schémas Pydantic.
- **DB** : calcul on-read ou cache JSON optionnel (pas de nouvelle source ingest).
- **Web** : Home (chart forme), Coach (adhérence), types TS.
- **Dépendance** : `features_json.trimp_edwards` + `CoachPlan.plan_json` déjà en place.

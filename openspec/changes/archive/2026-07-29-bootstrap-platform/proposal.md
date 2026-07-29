# Proposal: bootstrap-platform (P0)

## Intent

Poser le socle du projet RunningDashboard avant toute feature métier :
gouvernance OpenSpec, monorepo front/back séparés, infra Docker, logs
configurables, README simple.

## Why

Sans socle clair, les paliers Strava / météo / analytics / coach risquent
de mélanger front et back, de disperser la doc, et de rendre le suivi flou.
P0 fixe l’architecture et le contrat d’évolution.

## Scope

- Config OpenSpec projet + change P0
- Monorepo `apps/web`, `apps/api`, `infra/`
- Docker Compose : Postgres 16, API, web, Ollama, reverse proxy
- API FastAPI minimale (health) + logging FR path configurable
- Frontend React/Vite minimal (page d’accueil)
- README 4 blocs ; `.env.example` ; `.gitignore`

## Non-goals

- Sync Strava / OAuth
- Enrichissement météo
- Analytics / catégories d’évolution
- Coach LLM branché (image Ollama présente, pas d’appels métier)
- Import Apple Forme/Santé (hors scope définitif)

## Approach

Créer le change OpenSpec, implémenter le scaffold, valider, archiver pour
fusionner les specs domaines dans `openspec/specs/`.

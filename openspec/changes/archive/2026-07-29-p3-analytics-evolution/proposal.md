# Proposal: p3-analytics-evolution

## Why

Les activités et la météo sont en base. Il faut maintenant des indicateurs d’évolution
(volume, allure, cadence, catégories) pour lire la progression sans encore de coach IA.

## What Changes

- Endpoint `GET /api/analytics/overview`
- Volumes hebdo, tendances allure / FC / PPM
- Catégorie d’évolution (progression, plateau, baisse, charge élevée, données insuffisantes)
- Résumé corrélation météo simple
- Section UI « Évolution »
- Limiter l’enrichissement météo par Sync (éviter timeout HTTP)

## Non-goals

- Coach LLM (P4)
- Graphiques complexes / cartes
- Compteur rate-limit Strava (suivi séparé)

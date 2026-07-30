# Proposal: predictions-pace

## Why

Les sorties et les types de séance sont en base, ainsi qu’une synthèse d’évolution (P3).
Il manque un moteur déterministe d’**allures prévisionnelles** (5 km, 10 km, semi, marathon,
EF / seuil / VMA) et de tendances, sur une page dédiée, avant que le coach IA (P4) les commente.

## What Changes

- Spec OpenSpec `predictions` + delta UI
- Service déterministe (Riegel + ancres compétition/test/qualité + charge)
- `GET /api/predictions/overview` (estimations, allures d’entraînement, tendances, confiance, warnings)
- Page UI `/predictions` (« Prévisions ») dans la nav
- Pas de LLM pour inventer des chronos

## Non-goals

- Coach LLM / texte généré (P4)
- Machine learning / modèle entraîné
- Import Apple Santé / RunGap
- Historisation persistée des snapshots (calcul à la demande suffit en v1)
- Prédiction par météo ou dénivelé fin

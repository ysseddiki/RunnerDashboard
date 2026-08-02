# next-sessions Specification

## Purpose
TBD

## Requirements

### Requirement: Prescriptions next_sessions
Le système SHALL calculer de façon déterministe une liste de 3 à 7 prochaines séances running (`next_sessions`) à partir de la forme (TSB/ACR), de l’adhérence au plan, des volumes easy/qualité et des allures d’entraînement, sans appeler le LLM.

#### Scenario: Athlete avec données suffisantes
- **GIVEN** au moins 5 activités running éligibles et des allures d’entraînement disponibles
- **WHEN** le client appelle `GET /api/analytics/next-sessions`
- **THEN** la réponse contient `available=true` et une liste `sessions` (3–7 items) avec `date`, `session_type`, `title_fr`, `rationale_fr`, et `source` = `rules`

#### Scenario: Fatigue
- **GIVEN** un statut de forme `fatigue` ou ACR ≥ 1.3
- **WHEN** `next_sessions` est calculé
- **THEN** aucune séance `seuil`, `vma` ou `fractionne` n’est prescrite dans les 3 premiers jours
- **AND** au moins une séance `ef` ou `recuperation` est présente

#### Scenario: Données insuffisantes
- **GIVEN** moins de 5 activités running
- **WHEN** `next_sessions` est demandé
- **THEN** `available=false` et un `reason_fr` explicite est renvoyé

### Requirement: Endpoint et aperçu overview
Le système SHALL exposer `GET /api/analytics/next-sessions` et inclure un aperçu `next_sessions` dans `/api/analytics/overview`.

#### Scenario: Overview
- **GIVEN** des prescriptions calculables
- **WHEN** l’overview analytics est demandée
- **THEN** le champ `next_sessions` contient au moins les prochaines séances (liste éventuellement tronquée) et `available`

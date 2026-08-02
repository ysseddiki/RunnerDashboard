## ADDED Requirements

### Requirement: Aperçu next_sessions et tendances dans analytics
Le système SHALL enrichir `/api/analytics/overview` avec `next_sessions` (aperçu prescriptions déterministes) et `session_type_trends_summary` (directions par type), calculés côté API.

#### Scenario: Overview enrichie
- **GIVEN** un athlète authentifié avec historique running
- **WHEN** `/api/analytics/overview` est appelé
- **THEN** la réponse inclut les clés `next_sessions` et `session_type_trends_summary` (objets pouvant avoir `available=false`)

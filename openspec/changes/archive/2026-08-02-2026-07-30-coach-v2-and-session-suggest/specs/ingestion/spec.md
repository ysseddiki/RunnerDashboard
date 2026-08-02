# Delta for ingestion

## ADDED Requirements

### Requirement: Suggestion automatique de session_type
Le système SHALL exposer des endpoints de suggestion de `session_type` basés sur des règles (allure, distance, D+, nom) avec raffinement IA local optionnel, sans écrire en base tant que l’utilisateur n’applique pas.

#### Scenario: Suggestion unitaire
- GIVEN une activité avec allure connue
- WHEN `POST /api/activities/{id}/suggest-session-type`
- THEN la réponse contient `suggested_session_type`, `confidence`, `source` (`rules` ou `ai`) et `rationale_fr`

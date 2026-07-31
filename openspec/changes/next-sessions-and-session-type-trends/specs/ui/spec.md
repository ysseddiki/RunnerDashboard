## ADDED Requirements

### Requirement: Affichage prochaines séances
L’UI SHALL afficher un bloc « Prochaines séances » (source règles) sur Home et Coach, à partir de l’API, sans recalcul métier côté front.

#### Scenario: Home
- **GIVEN** `next_sessions.available=true`
- **WHEN** l’utilisateur ouvre Home
- **THEN** la liste des séances prescrites (date, type, titre, rationale courte) est visible

#### Scenario: Indisponible
- **GIVEN** `available=false`
- **WHEN** l’utilisateur ouvre Home
- **THEN** un message FR explique le manque de données (ex. taguer les séances)

### Requirement: Affichage tendances par type
L’UI SHALL afficher un panel de tendances par `session_type` (direction, delta allure, label FR) sur Home (résumé) et une vue détaillée (Home section ou Predictions).

#### Scenario: Résumé Home
- **GIVEN** au moins une tendance `available`
- **WHEN** Home est affichée
- **THEN** un résumé des directions (mieux / stable / moins bon) par type est visible

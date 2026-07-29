# Delta for analytics

## ADDED Requirements

### Requirement: Vue d’évolution
Le système SHALL exposer une synthèse analytics (volumes, tendances, catégorie d’évolution) calculée à partir des activités locales.

#### Scenario: Athlete avec historique
- GIVEN au moins 5 sorties running en base
- WHEN l’UI demande `/api/analytics/overview`
- THEN une catégorie d’évolution et des indicateurs volume/allure sont renvoyés

#### Scenario: Peu de données
- GIVEN moins de 5 sorties
- WHEN l’overview est demandée
- THEN la catégorie est `donnees_insuffisantes`

### Requirement: Affichage UI évolution
L’UI SHALL afficher une section Évolution avec la catégorie, volumes et tendances principales.

#### Scenario: Lecture dashboard
- GIVEN des analytics disponibles
- WHEN l’utilisateur ouvre l’application
- THEN la section Évolution est visible sans action Sync supplémentaire

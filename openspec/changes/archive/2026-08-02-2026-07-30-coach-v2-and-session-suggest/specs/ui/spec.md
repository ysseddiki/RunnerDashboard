# Delta for ui

## ADDED Requirements

### Requirement: Suggestion de type de séance
L’UI SHALL permettre de demander une suggestion de type de séance pour une activité et de l’appliquer après confirmation.

#### Scenario: Suggérer puis appliquer
- GIVEN une activité sans type ou avec type à revoir
- WHEN l’utilisateur demande une suggestion
- THEN un type proposé et une confiance sont affichés
- AND l’utilisateur peut appliquer via le sélecteur existant

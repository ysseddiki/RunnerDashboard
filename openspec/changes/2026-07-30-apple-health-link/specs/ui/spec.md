# Delta for ui

## ADDED Requirements

### Requirement: Import Apple Santé dans Admin
L’UI Admin SHALL permettre d’uploader un export ZIP Apple Santé et d’afficher le résumé (candidats, liens, créations).

#### Scenario: Upload
- GIVEN Admin ouvert
- WHEN l’utilisateur envoie un ZIP valide
- THEN un résumé d’import s’affiche avec les candidats proposés

### Requirement: Badge source activité
L’UI SHALL indiquer la source d’une activité (Strava, Apple, ou Strava lié Apple).

#### Scenario: Liste
- GIVEN des activités de sources différentes
- WHEN la liste Activités est affichée
- THEN un badge source lisible est visible

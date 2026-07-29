# Delta for ui

## ADDED Requirements

### Requirement: Connexion et Sync Strava
L’UI SHALL proposer de connecter Strava et de lancer une synchronisation.

#### Scenario: Parcours P1
- GIVEN l’application ouverte
- WHEN Strava n’est pas connecté
- THEN un bouton de connexion est visible
- AND après connexion un bouton Sync est disponible

### Requirement: Liste et détail des activités
L’UI SHALL afficher la liste des activités synchronisées et un détail avec métriques dont la cadence PPM si présente.

#### Scenario: Affichage cadence
- GIVEN une activité avec cadence
- WHEN l’utilisateur ouvre le détail
- THEN la cadence en PPM est affichée

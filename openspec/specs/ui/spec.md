# ui Specification

## Purpose
TBD - created by archiving change bootstrap-platform. Update Purpose after archive.
## Requirements
### Requirement: Interface en français
Le système SHALL afficher l’interface utilisateur en français.

#### Scenario: Page d’accueil P0
- GIVEN l’application web démarrée
- WHEN l’utilisateur ouvre la page d’accueil
- THEN le contenu principal est en français

### Requirement: Page socle
Le système SHALL exposer une page d’accueil minimale indiquant le nom du produit et que le socle P0 est opérationnel.

#### Scenario: Smoke UI
- GIVEN le reverse proxy actif
- WHEN l’utilisateur accède à `/`
- THEN la page RunningDashboard se charge sans erreur

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

### Requirement: Page Prévisions
L’UI SHALL exposer une page dédiée `/predictions` listée dans la navigation principale sous le libellé « Prévisions ».

#### Scenario: Navigation
- GIVEN un utilisateur sur l’app
- WHEN il ouvre la nav
- THEN un lien « Prévisions » mène à `/predictions`

#### Scenario: Contenu
- GIVEN `/api/predictions/overview` disponible
- WHEN la page Prévisions est affichée
- THEN elle montre l’allure 10 km estimée, la grille des distances, les allures d’entraînement, la tendance et les warnings


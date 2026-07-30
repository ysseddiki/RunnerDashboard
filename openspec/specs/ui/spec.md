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

### Requirement: Page Coach
L’UI SHALL exposer une page `/coach` permettant de lancer une analyse IA et d’afficher la réponse.

#### Scenario: Analyse
- GIVEN un modèle Ollama installé
- WHEN l’utilisateur lance l’analyse depuis `/coach`
- THEN un conseil FR s’affiche
- AND un état d’erreur clair apparaît si Ollama / modèle est indisponible

### Requirement: UI synthèse et calendrier coach
L’UI Coach SHALL afficher en tête la synthèse et le plan sous forme de calendrier / cartes par jour, puis le markdown rendu.

#### Scenario: Rendu markdown
- GIVEN une réponse avec markdown (titres, listes)
- WHEN la page Coach affiche le conseil
- THEN le markdown est rendu (pas uniquement en texte préformaté)

### Requirement: Suggestion de type de séance
L’UI SHALL permettre de demander une suggestion de type de séance pour une activité et de l’appliquer après confirmation.

#### Scenario: Suggérer puis appliquer
- GIVEN une activité sans type ou avec type à revoir
- WHEN l’utilisateur demande une suggestion
- THEN un type proposé et une confiance sont affichés
- AND l’utilisateur peut appliquer via le sélecteur existant

### Requirement: Admin intégration modèle
L’UI Admin SHALL afficher le statut Ollama (joignable, modèle installé) et permettre de lancer le pull du modèle sélectionné.

#### Scenario: Pull
- GIVEN Admin ouvert et Ollama joignable
- WHEN l’utilisateur lance « Télécharger le modèle »
- THEN l’API `pull-model` est appelée
- AND le statut est rafraîchi ensuite

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


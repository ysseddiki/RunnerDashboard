# Delta for ui

## ADDED Requirements

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

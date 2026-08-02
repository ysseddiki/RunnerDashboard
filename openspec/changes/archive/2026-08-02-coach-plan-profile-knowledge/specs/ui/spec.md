## ADDED Requirements

### Requirement: Page Profil coureur
L’UI SHALL exposer `/profile` dans la navigation pour éditer le profil et afficher zones / VO2max / projection.

#### Scenario: Navigation
- **WHEN** l’utilisateur ouvre la nav
- **THEN** un lien « Profil » mène à `/profile`

### Requirement: Coach plan hors analyse
L’UI Coach SHALL charger et afficher le plan calendrier depuis l’API plan sans exiger le bouton « Lancer l’analyse ».

#### Scenario: Ouverture Coach
- **WHEN** la page `/coach` est affichée
- **THEN** le plan calendrier est demandé via `GET /api/coach/plan`
- **AND** « Lancer l’analyse » ne sert qu’à la question libre / synthèse Q&A

### Requirement: Insights détail selon type de séance
L’UI détail d’activité SHALL afficher l’analyse coach stockée et des blocs d’aide à la lecture (métriques / textes) adaptés au type de séance quand disponible.

#### Scenario: Fractionné vs EF
- **WHEN** une activité taguée `fractionne` est ouverte
- **THEN** les insights mis en avant diffèrent d’une activité taguée `ef`

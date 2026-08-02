## ADDED Requirements

### Requirement: Série de projection
Le système SHALL exposer `GET /api/projections/overview` avec une série déterministe d’évolution (volume et/ou allure 10 km estimée) sur un horizon documenté (ex. 8–12 semaines).

#### Scenario: Historique + projection
- **WHEN** au moins 5 activités existent
- **THEN** la réponse contient des points passés et des points projetés
- **AND** les valeurs projetées sont calculées sans appel LLM

### Requirement: Affichage graph projection
L’UI SHALL afficher un graphique de projection (charte ECharts existante) sur la page profil ou coach.

#### Scenario: Lecture
- **WHEN** l’utilisateur ouvre la page concernée
- **THEN** le graph de projection est visible si des données existent

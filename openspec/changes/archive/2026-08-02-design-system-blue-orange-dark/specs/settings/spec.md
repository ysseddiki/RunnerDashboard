## ADDED Requirements

### Requirement: Préférence de thème
Le système SHALL permettre de choisir le thème d’interface (`Clair`, `Sombre`, `Système`) depuis Paramètres (ou un contrôle équivalent dans le shell).

#### Scenario: Changement de thème
- **GIVEN** un utilisateur sur Paramètres
- **WHEN** il sélectionne `Sombre`
- **THEN** l’UI passe immédiatement en palette dark
- **AND** le choix est mémorisé pour les prochaines visites (au minimum en local)

#### Scenario: Système
- **GIVEN** le thème `Système`
- **WHEN** la préférence OS change
- **THEN** l’UI suit la préférence OS sans action supplémentaire

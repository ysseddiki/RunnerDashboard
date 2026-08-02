# Delta for ui

## ADDED Requirements

### Requirement: Page Prévisions
L’UI SHALL exposer une page dédiée `/predictions` listée dans la navigation principale sous le libellé « Prévisions ».

#### Scenario: Navigation
- GIVEN un utilisateur authentifié sur l’app
- WHEN il ouvre la nav
- THEN un lien « Prévisions » mène à `/predictions`

#### Scenario: Contenu
- GIVEN `/api/predictions/overview` disponible
- WHEN la page Prévisions est affichée
- THEN elle montre l’allure 10 km estimée, la grille des distances, les allures d’entraînement, la tendance et les warnings

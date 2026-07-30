# Delta for ui

## ADDED Requirements

### Requirement: Page Coach
L’UI SHALL exposer une page `/coach` permettant de lancer une analyse IA et d’afficher la réponse.

#### Scenario: Analyse
- GIVEN un modèle Ollama installé
- WHEN l’utilisateur lance l’analyse depuis `/coach`
- THEN un conseil FR s’affiche
- AND un état d’erreur clair apparaît si Ollama / modèle est indisponible

### Requirement: Admin intégration modèle
L’UI Admin SHALL afficher le statut Ollama (joignable, modèle installé) et permettre de lancer le pull du modèle sélectionné.

#### Scenario: Pull
- GIVEN Admin ouvert et Ollama joignable
- WHEN l’utilisateur lance « Télécharger le modèle »
- THEN l’API `pull-model` est appelée
- AND le statut est rafraîchi ensuite

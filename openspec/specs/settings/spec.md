# settings Specification

## Purpose
TBD - created by archiving change document-llm-model-profiles. Update Purpose after archive.
## Requirements
### Requirement: Choix du modèle dans l’UI
Le système SHALL permettre de choisir le modèle IA depuis un écran Paramètres de l’interface (liste des profils 7B et 14B).

#### Scenario: Enregistrement du choix
- GIVEN un utilisateur sur la page Paramètres
- WHEN il sélectionne `qwen2.5:7b` ou `qwen2.5:14b` et enregistre
- THEN la valeur est persistée via l’API en base
- AND les prochains appels coach utilisent ce tag

### Requirement: Défaut depuis l’environnement
Le système SHALL initialiser le modèle depuis `OLLAMA_MODEL` si aucun réglage utilisateur n’existe encore.

#### Scenario: Premier démarrage
- GIVEN une base sans réglage `ollama_model`
- WHEN l’API résout le modèle à utiliser
- THEN elle utilise la valeur de `OLLAMA_MODEL` (défaut `qwen2.5:14b`)

### Requirement: Avertissement profil vs machine
Le système SHALL afficher un avertissement clair si l’utilisateur sélectionne le profil 14B, rappelant qu’une VM ~32 Go est recommandée.

#### Scenario: Sélection 14B
- GIVEN la page Paramètres
- WHEN l’utilisateur sélectionne `qwen2.5:14b`
- THEN un message d’avertissement sur la RAM recommandée est visible
- AND la sélection reste possible


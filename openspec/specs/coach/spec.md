# coach Specification

## Purpose
TBD - created by archiving change document-llm-model-profiles. Update Purpose after archive.
## Requirements
### Requirement: Deux profils de modèle locaux
Le système SHALL supporter exactement deux profils de modèle Ollama documentés : `qwen2.5:7b` (VM ~16 Go) et `qwen2.5:14b` (VM ~32 Go, défaut recommandé).

#### Scenario: Profil léger
- GIVEN une VM d’environ 16 Go de RAM
- WHEN l’opérateur choisit le profil léger
- THEN le tag utilisé est `qwen2.5:7b`

#### Scenario: Profil standard
- GIVEN une VM d’environ 32 Go de RAM
- WHEN aucun override n’est défini
- THEN le tag par défaut est `qwen2.5:14b`

### Requirement: Inférence locale uniquement
Le système SHALL exécuter le coach via Ollama en local, sans envoyer les données d’activité à un service IA cloud.

#### Scenario: Pas de cloud IA
- GIVEN une demande de conseil coach
- WHEN l’API appelle le modèle
- THEN l’appel cible uniquement le service Ollama local


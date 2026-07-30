# Delta for coach

## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Contexte prévisions et métriques
Le système SHALL construire un contexte déterministe pour le coach incluant prévisions d’allure, analytics d’évolution, et sorties récentes (distance, allure min/km, FC, type de séance, cadence si dispo, météo).

#### Scenario: Corrélation
- GIVEN des prévisions et des activités en base
- WHEN l’utilisateur demande un conseil
- THEN le prompt contient ces données structurées
- AND le modèle est instruit de ne pas inventer de chronos absents du contexte

### Requirement: Endpoints coach
Le système SHALL exposer `GET /api/coach/status`, `POST /api/coach/pull-model` et `POST /api/coach/advise`.

#### Scenario: Statut
- GIVEN Ollama joignable
- WHEN le client appelle `/api/coach/status`
- THEN la réponse indique `reachable`, le modèle configuré et s’il est installé

#### Scenario: Conseil
- GIVEN un modèle installé
- WHEN le client appelle `/api/coach/advise`
- THEN une réponse texte FR est renvoyée avec le tag modèle utilisé

### Requirement: Procédure d’intégration documentée
Le README SHALL documenter le pull du modèle (CLI et/ou UI Admin) et le choix 7B/14B selon la RAM.

#### Scenario: Premier démarrage P4
- GIVEN une stack fraîche
- WHEN l’opérateur suit le README
- THEN il peut installer le modèle et obtenir un premier conseil coach

# coach Specification

## Purpose
Coach running local via Ollama : conseils FR à partir des prévisions, analytics et activités, sans cloud IA.

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

### Requirement: Réponse coach structurée
Le système SHALL faire produire par le coach un objet avec `summary` et `markdown` pour la Q&A libre (`advise`) ; le champ `plan` MAY être vide car le calendrier est géré par l’endpoint plan dédié.

#### Scenario: Conseil Q&A
- **WHEN** `/api/coach/advise` réussit
- **THEN** la réponse contient un `summary` non vide
- **AND** un champ `markdown` pour l’analyse détaillée
- **AND** le plan calendrier affiché côté UI reste celui de `GET /api/coach/plan`

### Requirement: Procédure d’intégration documentée
Le README SHALL documenter le pull du modèle (CLI et/ou UI Admin) et le choix 7B/14B selon la RAM.

#### Scenario: Premier démarrage P4
- GIVEN une stack fraîche
- WHEN l’opérateur suit le README
- THEN il peut installer le modèle et obtenir un premier conseil coach

### Requirement: Plan calendrier persisté
Le système SHALL stocker un plan calendrier coach indépendant de `POST /api/coach/advise` et l’exposer via `GET /api/coach/plan`.

#### Scenario: Lecture sans analyse
- **WHEN** l’utilisateur ouvre la page Coach
- **THEN** le plan affiché provient de `GET /api/coach/plan`
- **AND** aucun appel `advise` n’est requis pour voir le plan

### Requirement: Rafraîchissement du plan
Le système SHALL permettre `POST /api/coach/plan/refresh` et SHALL enclencher un refresh (async, single-flight) après synchronisation lorsqu’au moins une nouvelle activité a été importée.

#### Scenario: Post-sync
- **WHEN** une sync Strava importe au moins une nouvelle activité
- **THEN** un job de refresh plan est planifié au plus une fois
- **AND** le job utilise le pack knowledge + contexte déterministe + profil

### Requirement: Analyse par activité
Le système SHALL générer et persister une analyse coach locale par activité (`summary` + `markdown` + métadonnées) via endpoint dédié et/ou job post-sync pour les activités sans analyse.

#### Scenario: Détail activité
- **WHEN** l’utilisateur ouvre une activité analysée
- **THEN** l’UI affiche l’analyse stockée
- **AND** les insights présentés varient selon le `session_type` quand présent

### Requirement: Keep-alive Ollama configurable
Le système SHALL envoyer `keep_alive` configurable (défaut `-1`, ne jamais décharger) à chaque appel chat Ollama.

#### Scenario: Modèle chaud
- **WHEN** `OLLAMA_KEEP_ALIVE=-1`
- **THEN** chaque requête chat demande à Ollama de garder le modèle chargé
- **AND** les appels suivants n’imposent pas un rechargement après 10 minutes d’inactivité

### Requirement: Contexte forme et adhérence
Le système SHALL injecter dans le contexte coach (advise / refresh plan) un résumé déterministe de forme (ATL, CTL, TSB, status) et d’adhérence (pourcentage, séances manquées), sans laisser le LLM inventer ces métriques.

#### Scenario: Advise avec faits
- GIVEN forme et adhérence disponibles
- WHEN une analyse coach est lancée
- THEN le prompt utilisateur contient les valeurs ATL/CTL/TSB et le % d’adhérence issus de l’API
- AND le system prompt rappelle de ne pas inventer de chiffres absents

#### Scenario: Faits absents
- GIVEN forme ou adhérence indisponible
- WHEN le contexte est construit
- THEN le champ correspondant indique l’indisponibilité
- AND aucune valeur fictive n’est substituée

### Requirement: Contexte coach avec next_sessions et tendances
Le système SHALL inclure dans le contexte coach déterministe un résumé `next_sessions` et `session_type_trends` lorsque disponibles, et instruire le modèle de ne pas inventer de prescriptions ou de directions absentes du contexte.

#### Scenario: Advise avec faits
- **GIVEN** des next_sessions et tendances calculables
- **WHEN** `POST /api/coach/advise` construit le contexte
- **THEN** le payload contient `next_sessions` et `session_type_trends`
- **AND** le prompt système rappelle de ne pas inventer ces faits

## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Réponse coach structurée
Le système SHALL faire produire par le coach un objet avec `summary` et `markdown` pour la Q&A libre (`advise`) ; le champ `plan` MAY être vide car le calendrier est géré par l’endpoint plan dédié.

#### Scenario: Conseil Q&A
- **WHEN** `/api/coach/advise` réussit
- **THEN** la réponse contient un `summary` non vide
- **AND** un champ `markdown` pour l’analyse détaillée
- **AND** le plan calendrier affiché côté UI reste celui de `GET /api/coach/plan`

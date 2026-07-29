# Delta for platform

## ADDED Requirements

### Requirement: Séparation front et back
Le système SHALL maintenir le frontend et le backend dans des packages distincts (`apps/web`, `apps/api`) sans logique métier dans le frontend.

#### Scenario: Appels données
- GIVEN une page du frontend
- WHEN des données métier sont nécessaires
- THEN le frontend appelle uniquement l’API HTTP
- AND le frontend n’accède ni à Postgres ni à Ollama directement

### Requirement: Infrastructure conteneurisée
Le système SHALL fournir un Docker Compose démarrant au minimum Postgres, API, web, Ollama et un reverse proxy.

#### Scenario: Démarrage local
- GIVEN un `.env` renseigné à partir de `.env.example`
- WHEN l’opérateur lance `docker compose up`
- THEN les services démarrent
- AND l’endpoint health de l’API répond OK via le proxy

### Requirement: Base PostgreSQL
Le système SHALL utiliser PostgreSQL 16 conteneurisé comme base de données principale.

#### Scenario: Persistance
- GIVEN Compose démarré
- WHEN le conteneur Postgres redémarre
- THEN les données persistent via un volume nommé

# Delta for ingestion

## ADDED Requirements

### Requirement: OAuth Strava
Le système SHALL permettre de connecter un compte Strava via OAuth et de stocker les tokens localement.

#### Scenario: Connexion réussie
- GIVEN une application Strava configurée
- WHEN l’utilisateur autorise l’accès
- THEN les tokens sont enregistrés en base
- AND l’UI indique que Strava est connecté

### Requirement: Synchronisation depuis l’UI
Le système SHALL importer les activités running depuis Strava uniquement lors d’une action Sync explicite.

#### Scenario: Sync incrémentale
- GIVEN des tokens valides
- WHEN l’utilisateur lance Sync
- THEN les nouvelles activités sont upsertées
- AND un résumé (créées/mises à jour) est renvoyé

### Requirement: Persistance cadence PPM
Le système SHALL stocker `cadence_ppm` lorsqu’elle est fournie par Strava, sinon null avec log explicite.

#### Scenario: Cadence absente
- GIVEN une activité sans cadence
- WHEN elle est importée
- THEN `cadence_ppm` est null
- AND un log FR indique l’absence

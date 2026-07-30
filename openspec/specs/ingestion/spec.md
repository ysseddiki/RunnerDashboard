# ingestion Specification

## Purpose
Ingestion des activités : sync Strava principale, import Apple Santé secondaire (fichier), cadence PPM, tags de séance.

## Requirements

### Requirement: Source sport Strava
Le système SHALL utiliser Strava comme source principale d’activités synchronisées en ligne.
Apple Santé MAY être importé via fichier export (ZIP) comme source secondaire.

#### Scenario: Périmètre sync réseau
- GIVEN le socle
- WHEN aucune sync Apple cloud n’est demandée
- THEN seule Strava (et météo) utilise le réseau pour les activités
- AND l’import Apple se fait par upload de fichier local

### Requirement: Cadence en PPM
Le système SHALL traiter la cadence de course comme une cadence en pas par minute (PPM) lorsqu’elle est disponible.

#### Scenario: Absence de cadence
- GIVEN une activité Strava sans cadence
- WHEN elle sera importée (P1)
- THEN le champ cadence PPM pourra être null
- AND un log explicite indiquera l’absence

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

### Requirement: Suggestion automatique de session_type
Le système SHALL exposer des endpoints de suggestion de `session_type` basés sur des règles (allure, distance, D+, nom) avec raffinement IA local optionnel, sans écrire en base tant que l’utilisateur n’applique pas.

#### Scenario: Suggestion unitaire
- GIVEN une activité avec allure connue
- WHEN `POST /api/activities/{id}/suggest-session-type`
- THEN la réponse contient `suggested_session_type`, `confidence`, `source` (`rules` ou `ai`) et `rationale_fr`

### Requirement: Import Apple Santé workouts
Le système SHALL accepter un ZIP d’export Apple Santé, parser les workouts pertinents, et les upsert dans `apple_workouts`.

#### Scenario: Import avec candidats
- GIVEN un ZIP contenant `export.xml` avec des workouts running
- WHEN `POST /api/apple-health/import`
- THEN chaque workout importé est renvoyé avec une liste de candidats Strava (éventuellement vide)
- AND les actions auto (lien haute confiance / promote sans match) sont indiquées

### Requirement: Enrichissement sans écrasement
Lors d’un lien Apple → Strava, le système SHALL remplir uniquement les métriques absentes (trous), sans remplacer une valeur Strava déjà présente.

#### Scenario: Cadence manquante
- GIVEN une activité Strava sans `cadence_ppm` et un workout Apple avec cadence
- WHEN le lien est établi
- THEN `cadence_ppm` est renseignée depuis Apple
- AND distance / temps Strava restent inchangés

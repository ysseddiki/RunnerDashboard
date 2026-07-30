# Delta for ingestion

## MODIFIED Requirements

### Requirement: Source sport Strava
Le système SHALL utiliser Strava comme source principale d’activités synchronisées en ligne.
Apple Santé MAY être importé via fichier export (ZIP) comme source secondaire.

#### Scenario: Périmètre sync réseau
- GIVEN le socle
- WHEN aucune sync Apple cloud n’est demandée
- THEN seule Strava (et météo) utilise le réseau pour les activités
- AND l’import Apple se fait par upload de fichier local

## ADDED Requirements

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

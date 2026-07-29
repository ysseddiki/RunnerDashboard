# Delta for weather

## ADDED Requirements

### Requirement: Enrichissement météo au Sync
Le système SHALL enrichir les activités running avec la météo historique au moment de la Sync UI, via Open-Meteo, et stocker le résultat localement.

#### Scenario: Sortie outdoor avec GPS
- GIVEN une activité avec start_lat/start_lng et start_date
- WHEN le Sync s’exécute
- THEN weather_json est renseigné (température, humidité, précipitations, vent, code)
- AND un log FR confirme l’enrichissement

#### Scenario: Pas de GPS
- GIVEN une activité sans coordonnées
- WHEN le Sync tente l’enrichissement
- THEN weather_json reste null
- AND un log FR explique l’absence

### Requirement: Affichage météo
L’UI SHALL afficher la météo associée dans le détail d’une activité lorsqu’elle est disponible.

#### Scenario: Détail avec météo
- GIVEN une activité enrichie
- WHEN l’utilisateur ouvre le détail
- THEN température, conditions, vent et précipitations sont visibles

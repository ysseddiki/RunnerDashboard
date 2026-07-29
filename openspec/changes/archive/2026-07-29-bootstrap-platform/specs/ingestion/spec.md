# Delta for ingestion

## ADDED Requirements

### Requirement: Source sport Strava
Le système SHALL utiliser Strava comme unique source d’activités sportives (Apple Forme/Santé hors scope).

#### Scenario: Périmètre P0
- GIVEN le socle P0
- WHEN aucune sync n’est encore implémentée
- THEN la spec source Strava est documentée pour P1
- AND aucune dépendance Apple Santé n’est introduite

### Requirement: Cadence en PPM
Le système SHALL traiter la cadence de course comme une cadence en pas par minute (PPM) lorsqu’elle est disponible.

#### Scenario: Absence de cadence
- GIVEN une activité Strava sans cadence
- WHEN elle sera importée (P1)
- THEN le champ cadence PPM pourra être null
- AND un log explicite indiquera l’absence

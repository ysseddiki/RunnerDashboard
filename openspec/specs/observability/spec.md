# observability Specification

## Purpose
TBD - created by archiving change bootstrap-platform. Update Purpose after archive.
## Requirements
### Requirement: Répertoire de logs configurable
Le système SHALL écrire les logs applicatifs dans un chemin configurable via la variable d’environnement `LOG_DIR`.

#### Scenario: Path personnalisé
- GIVEN `LOG_DIR=/data/logs`
- WHEN l’API démarre
- THEN les logs sont écrits sous ce répertoire
- AND le même flux est aussi émis sur stdout

### Requirement: Messages de log explicites
Le système SHALL produire des logs en français, clairs, avec niveau, module et contexte clé=valeur, sans secrets.

#### Scenario: Erreur sans fuite
- GIVEN une erreur métier ou technique
- WHEN le log est émis
- THEN le message décrit la cause en français
- AND aucun token, mot de passe ou secret n’apparaît

### Requirement: Niveau de log configurable
Le système SHALL respecter `LOG_LEVEL` (DEBUG, INFO, WARNING, ERROR).

#### Scenario: Filtrage
- GIVEN `LOG_LEVEL=INFO`
- WHEN un événement DEBUG se produit
- THEN il n’est pas écrit dans le fichier de log applicatif


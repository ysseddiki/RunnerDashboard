# athlete-profile Specification

## Purpose
TBD

## Requirements

### Requirement: Profil athlète unique
Le système SHALL stocker un profil coureur local (`birth_date`, poids_kg, taille_cm, fc_repos, fc_max, sexe optionnel, objectif texte) via `GET/PUT /api/profile`. L’âge SHALL être dérivé de `birth_date`.

#### Scenario: Enregistrement
- **WHEN** l’utilisateur enregistre son profil depuis `/profile`
- **THEN** les valeurs courantes sont persistées en Postgres
- **AND** un snapshot est ajouté à l’historique suivi (si les valeurs ont changé)
- **AND** aucune donnée n’est envoyée à un cloud IA

#### Scenario: Âge dérivé
- **WHEN** le profil contient une `birth_date`
- **THEN** l’API expose `age` calculé à la date du jour
- **AND** les zones / VO2 utilisent cet âge si `fc_max` est absente

### Requirement: Historique du profil
Le système SHALL conserver un historique des enregistrements du profil (poids, FC, taille, etc.) consultable via `GET /api/profile` (`history`).

#### Scenario: Consultation
- **WHEN** l’utilisateur ouvre `/profile`
- **THEN** la liste des snapshots passés est affichée (plus récent en premier)

### Requirement: Zones et VO2 déterministes
Le système SHALL calculer les zones d’intensité et une estimation VO2max de façon déterministe à partir du profil et/ou des performances, selon les formules documentées dans le pack knowledge ; le LLM MUST NOT être la source de ces chiffres.

#### Scenario: Zones affichées
- **WHEN** le profil contient fc_repos et fc_max (ou fc_max dérivée de l’âge)
- **THEN** l’API renvoie des zones FC nommées avec bornes bpm
- **AND** une estimation VO2max si les données suffisent, sinon `null` avec raison FR

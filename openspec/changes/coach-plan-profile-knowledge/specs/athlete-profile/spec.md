## ADDED Requirements

### Requirement: Profil athlète unique
Le système SHALL stocker un profil coureur local (âge, poids_kg, taille_cm, fc_repos, fc_max, sexe optionnel, objectif texte) via `GET/PUT /api/profile`.

#### Scenario: Enregistrement
- **WHEN** l’utilisateur enregistre son profil depuis `/profile`
- **THEN** les valeurs sont persistées en Postgres
- **AND** aucune donnée n’est envoyée à un cloud IA

### Requirement: Zones et VO2 déterministes
Le système SHALL calculer les zones d’intensité et une estimation VO2max de façon déterministe à partir du profil et/ou des performances, selon les formules documentées dans le pack knowledge ; le LLM MUST NOT être la source de ces chiffres.

#### Scenario: Zones affichées
- **WHEN** le profil contient fc_repos et fc_max (ou fc_max dérivée de l’âge)
- **THEN** l’API renvoie des zones FC nommées avec bornes bpm
- **AND** une estimation VO2max si les données suffisent, sinon `null` avec raison FR

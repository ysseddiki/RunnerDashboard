# run-comparison Specification

## Purpose
TBD

## Requirements

### Requirement: Comparaison de deux activités
Le système SHALL permettre à un utilisateur authentifié de comparer exactement deux de ses activités running via une API dédiée.

#### Scenario: Comparaison réussie
- **WHEN** l’utilisateur envoie deux `activity_ids` lui appartenant
- **THEN** l’API retourne une comparaison ordonnée chronologiquement (A plus ancienne, B plus récente) avec métriques et textes FR

#### Scenario: Activité hors périmètre
- **WHEN** au moins un id n’existe pas ou n’appartient pas à l’utilisateur
- **THEN** l’API refuse la requête (404 ou 403) sans exposer de données d’autrui

#### Scenario: Nombre d’ids invalide
- **WHEN** le body ne contient pas exactement deux ids distincts
- **THEN** l’API refuse avec une erreur de validation explicite en français

### Requirement: Introduction par le délai entre séances
La comparaison MUST commencer par une introduction indiquant le temps écoulé entre les deux exercices.

#### Scenario: Intervalle en jours
- **WHEN** les deux activités ont des `start_date` valides séparées de N jours calendaires (N ≥ 1)
- **THEN** la réponse inclut `days_between` et un `interval_label_fr` lisible (ex. « 12 jours », « 3 semaines »)

#### Scenario: Même jour
- **WHEN** les deux activités sont le même jour calendaire
- **THEN** l’introduction indique clairement qu’elles ont lieu le même jour (pas de faux « progrès » temporel)

### Requirement: Analyse intelligente contextualisée
Le système SHALL produire des deltas et un verdict global déterministe, en tenant compte du contexte (type, distance, disponibilité des métriques), sans appeler un LLM.

#### Scenario: Amélioration d’allure à distances comparables
- **WHEN** les distances relatives diffèrent de moins de 20 % et l’allure de B est plus rapide que A
- **THEN** la métrique allure a `direction` = `mieux` et le résumé peut indiquer une progression d’allure

#### Scenario: Distances très différentes
- **WHEN** les distances relatives diffèrent de plus de 20 %
- **THEN** la réponse inclut un caveat FR et n’affirme pas un progrès d’allure sans réserve

#### Scenario: Types de séance différents
- **WHEN** les `session_type` des deux activités diffèrent (et ne sont pas tous deux absents)
- **THEN** la réponse inclut un caveat FR et baisse la confiance du verdict global si pertinent

#### Scenario: Signaux features absents
- **WHEN** une métrique dérivée (`decoupling_pct`, `cv_pace`, etc.) est absente pour l’une des deux
- **THEN** cette métrique est omise ou marquée indisponible avec raison FR, sans inventer de valeur

### Requirement: Synthèse en français
La réponse MUST exposer une synthèse exploitable en UI : introduction, verdict, métriques, caveats.

#### Scenario: Champs de synthèse présents
- **WHEN** une comparaison réussit
- **THEN** la réponse inclut au minimum `intro_fr`, `overall_direction`, `overall_summary_fr`, une liste de métriques comparées, et éventuellement `caveats_fr`

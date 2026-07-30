# plan-adherence Specification

## Purpose

Mesurer l’écart entre le plan calendrier coach persisté et les séances running réellement réalisées.

## ADDED Requirements

### Requirement: Matching plan vers activités
Le système SHALL associer chaque item du plan coach ayant une date aux activités running éligibles via un matching déterministe (fenêtre ±1 jour, priorité `session_type`, volume si disponible), avec au plus une activité par item et une confiance.

#### Scenario: Séance réalisée le jour prévu
- GIVEN un item plan daté J avec `session_type` = `tempo`
- AND une activité running le jour J taguée `tempo`
- WHEN l’adhérence est calculée
- THEN l’item est `matched` avec l’`activity_id` correspondant
- AND la confiance est au moins `moyenne`

#### Scenario: Séance manquée
- GIVEN un item plan daté dans le passé sans candidat suffisant
- WHEN l’adhérence est calculée
- THEN le statut est `missed`

#### Scenario: Séance à venir
- GIVEN un item plan daté dans le futur
- WHEN l’adhérence est calculée
- THEN le statut est `upcoming`
- AND il n’entre pas dans le dénominateur du pourcentage passé

### Requirement: Score d’adhérence
Le système SHALL calculer un pourcentage d’adhérence sur les items passés du plan (et optionnellement la fenêtre 7 jours) : matched / planned_past, avec compteurs matched, missed, et écarts de type.

#### Scenario: Semaine partielle
- GIVEN 4 items passés dont 3 matched et 1 missed
- WHEN le score est demandé
- THEN `adherence_pct` vaut 75
- AND les compteurs reflètent 3/1

#### Scenario: Plan vide ou incomplet
- GIVEN aucun plan ou items sans date
- WHEN l’adhérence est demandée
- THEN `available` est faux
- AND un `reason_fr` indique l’impossibilité de scorer

### Requirement: Exposition API adhérence
Le système SHALL exposer le détail d’adhérence (items annotés + scores) via l’API coach (plan enrichi et/ou endpoint dédié).

#### Scenario: Lecture plan enrichi
- GIVEN un plan non vide et des activités en base
- WHEN le client demande le plan / l’adhérence
- THEN chaque item inclut `status`, `activity_id` éventuel et `confidence`
- AND le résumé contient `adherence_pct` si calculable

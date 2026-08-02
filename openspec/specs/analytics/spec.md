# analytics Specification

## Purpose
TBD - created by archiving change p3-analytics-evolution. Update Purpose after archive.

## Requirements

### Requirement: Vue d’évolution
Le système SHALL exposer une synthèse analytics (volumes, tendances, catégorie d’évolution, charge TRIMP si disponible) calculée à partir des activités **running éligibles** locales.

#### Scenario: Athlete avec historique
- GIVEN au moins 5 sorties running éligibles en base
- WHEN l’UI demande `/api/analytics/overview`
- THEN une catégorie d’évolution et des indicateurs volume/allure sont renvoyés
- AND le pool exclut Walk/Hiking

#### Scenario: Peu de données
- GIVEN moins de 5 sorties running éligibles
- WHEN l’overview est demandée
- THEN la catégorie est `donnees_insuffisantes`

### Requirement: Affichage UI évolution
L’UI SHALL afficher une section Évolution avec la catégorie, volumes et tendances principales.

#### Scenario: Lecture dashboard
- GIVEN des analytics disponibles
- WHEN l’utilisateur ouvre l’application
- THEN la section Évolution est visible sans action Sync supplémentaire

### Requirement: Pool running pour les agrégats
Le système SHALL calculer la catégorie d’évolution, les tendances d’allure et les volumes de charge analytics uniquement sur les activités running éligibles (Run / TrailRun / VirtualRun, et Apple promues Run), en excluant marche et randonnée.

#### Scenario: Mix running et marche
- GIVEN 6 courses Run et 10 marches Walk en base
- WHEN `/api/analytics/overview` est demandé
- THEN le seuil « ≥ 5 sorties » et les tendances d’allure ne comptent que les 6 Run
- AND les Walk n’influencent pas la catégorie d’évolution

#### Scenario: Seulement marches
- GIVEN uniquement des activités Walk/Hiking
- WHEN l’overview est demandée
- THEN la catégorie est `donnees_insuffisantes`

### Requirement: Charge physiologique TRIMP
Le système SHALL exposer dans l’overview une synthèse de charge basée sur le TRIMP Edwards des activités running (somme 7 jours, somme 28 jours, ratio aigu/chronique), en complément des indicateurs de volume existants.

#### Scenario: Historique avec features TRIMP
- GIVEN au moins 5 sorties running avec `trimp_edwards` calculé
- WHEN l’overview est demandée
- THEN la réponse inclut `load.trimp_7d`, `load.trimp_28d` et `load.acr`
- AND ces valeurs sont déterministes (même entrée → même sortie)

#### Scenario: TRIMP indisponible
- GIVEN des sorties running sans FC / sans zones
- WHEN l’overview est demandée
- THEN `load` indique l’indisponibilité sans inventer de TRIMP à 0

### Requirement: Volumes EF vs qualité
Le système SHALL exposer le volume 28 jours séparé entre séances faciles (`ef`, `recuperation`, `endurance_active`, `sortie_longue`) et séances qualité (`tempo`, `seuil`, `fractionne`, `vma`, `cotes`, `fartlek`, `competition`, `test`).

#### Scenario: Répartition typée
- GIVEN des activités taguées EF et fractionné sur 28 jours
- WHEN l’overview est demandée
- THEN `volume_easy_km_28d` et `volume_quality_km_28d` reflètent cette répartition
- AND les activités sans `session_type` sont comptées dans un bucket `untagged` explicite

### Requirement: Affichage charge et répartition
L’UI SHALL afficher dans la section Évolution les indicateurs de charge TRIMP/ACR lorsqu’ils sont disponibles, ainsi que la répartition volume facile / qualité.

#### Scenario: Dashboard avec load
- GIVEN une overview contenant `load` et les volumes séparés
- WHEN l’utilisateur ouvre l’accueil
- THEN charge et répartition sont visibles sans Sync supplémentaire
- AND si `load` est indisponible, un message FR clair l’indique

### Requirement: Forme dans l’overview
Le système SHALL inclure dans `/api/analytics/overview` un objet `form` (ATL, CTL, TSB, status, labels FR) lorsque la série de charge est disponible, en complément de `load` (TRIMP/ACR).

#### Scenario: Overview avec forme
- GIVEN une série de charge disponible
- WHEN l’overview est demandée
- THEN `form.atl`, `form.ctl`, `form.tsb` et `form.status` sont présents
- AND `form.status_label_fr` est renseigné

#### Scenario: Forme indisponible
- GIVEN TRIMP insuffisant
- WHEN l’overview est demandée
- THEN `form.available` est faux
- AND `form.reason_fr` est explicite
- AND le reste de l’overview (catégorie, volumes) reste calculé

### Requirement: Endpoint série de charge
Le système SHALL exposer `GET /api/analytics/load-series` retournant la série journalière pour affichage graphique (fenêtre paramétrable, défaut ~84 jours).

#### Scenario: Chart Home
- GIVEN des données TRIMP sur plusieurs semaines
- WHEN l’UI demande la série
- THEN les points journaliers permettent de tracer ATL, CTL et TSB

### Requirement: Aperçu next_sessions et tendances dans analytics
Le système SHALL enrichir `/api/analytics/overview` avec `next_sessions` (aperçu prescriptions déterministes) et `session_type_trends_summary` (directions par type), calculés côté API.

#### Scenario: Overview enrichie
- **GIVEN** un athlète authentifié avec historique running
- **WHEN** `/api/analytics/overview` est appelé
- **THEN** la réponse inclut les clés `next_sessions` et `session_type_trends_summary` (objets pouvant avoir `available=false`)

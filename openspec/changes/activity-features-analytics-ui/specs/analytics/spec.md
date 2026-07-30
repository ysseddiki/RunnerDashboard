# Delta for analytics

## ADDED Requirements

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

## MODIFIED Requirements

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

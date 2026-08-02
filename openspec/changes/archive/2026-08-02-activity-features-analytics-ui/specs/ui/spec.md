# Delta for ui

## ADDED Requirements

### Requirement: Lecture déterministe par type de séance
L’UI du détail activité SHALL afficher un bloc de lecture déterministe (KPIs issus de `features_json`) adapté au `session_type`, avec états N/A explicites lorsque les capteurs manquent.

#### Scenario: Sortie longue avec decoupling
- GIVEN une activité `sortie_longue` dont `features_json` contient decoupling et splits
- WHEN l’utilisateur ouvre le détail
- THEN les KPIs longue (dérive cardiaque, splits) sont visibles en français
- AND aucune valeur inventée n’apparaît pour les champs `null`

#### Scenario: Fractionné sans détection
- GIVEN `session_type` = `fractionne` et `intervals` null
- WHEN le détail est affiché
- THEN un message indique que les intervalles n’ont pas pu être détectés
- AND les graphes de streams restent disponibles

### Requirement: Graphes adaptés au template de séance
L’UI SHALL adapter les graphes de streams au template du type de séance (overlays zones FC, bandes d’allure, segments travail/récup) lorsque les données features le permettent, sans recalcul métier côté front.

#### Scenario: Overlay zones sur EF
- GIVEN une activité `ef` avec `time_in_zone` et stream FC
- WHEN le détail affiche les graphes
- THEN un overlay ou résumé de zones est proposé
- AND le front consomme uniquement l’API (pas de recalcul des zones)

#### Scenario: Série absente
- GIVEN une activité sans watts
- WHEN les graphes sont rendus
- THEN la série watts n’est pas affichée

### Requirement: Tableau splits ou répétitions
L’UI du détail SHALL afficher un tableau des splits km et, si `intervals` est présent, un tableau des répétitions (allure, durée, FC).

#### Scenario: Splits disponibles
- GIVEN `features_json.splits_km` non vide
- WHEN l’utilisateur consulte le détail
- THEN un tableau des splits est affiché

#### Scenario: Intervalles détectés
- GIVEN `features_json.intervals` avec des segments travail
- WHEN l’utilisateur consulte le détail
- THEN un tableau des répétitions est affiché

## MODIFIED Requirements

### Requirement: Liste et détail des activités
L’UI SHALL afficher la liste des activités synchronisées et un détail avec métriques dont la cadence PPM si présente, enrichi des insights et graphes issus de `features_json` lorsque disponible.

#### Scenario: Affichage cadence
- GIVEN une activité avec cadence
- WHEN l’utilisateur ouvre le détail
- THEN la cadence en PPM est affichée

#### Scenario: Features présentes
- GIVEN une activité avec `features_json`
- WHEN l’utilisateur ouvre le détail
- THEN le bloc lecture déterministe est visible en plus des métriques résumé

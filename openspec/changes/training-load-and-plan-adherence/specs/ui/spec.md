# Delta for ui

## ADDED Requirements

### Requirement: Courbe de forme sur l’accueil
L’UI Home SHALL afficher une courbe de forme (CTL, ATL, et/ou TSB) à partir de l’API load-series, avec le statut de forme courant et un état vide FR si indisponible.

#### Scenario: Série disponible
- GIVEN `/api/analytics/load-series` avec `available` vrai
- WHEN l’utilisateur ouvre l’accueil
- THEN la courbe de forme est visible
- AND le badge/statut (ex. Frais, Fatigue) est affiché

#### Scenario: Pas assez de TRIMP
- GIVEN la série indisponible
- WHEN l’accueil charge l’évolution
- THEN un message FR explique qu’il faut plus de sorties avec FC/zones
- AND aucun graphique trompeur n’est inventé

### Requirement: Plan vs réalisé sur Coach
L’UI Coach SHALL afficher pour chaque item du plan un statut (fait, manqué, à venir) et le score d’adhérence lorsque l’API l’expose.

#### Scenario: Plan avec adhérence
- GIVEN un plan et une adhérence calculée
- WHEN la page Coach affiche le calendrier
- THEN les items matched/missed/upcoming sont distincts visuellement
- AND le pourcentage d’adhérence est visible

#### Scenario: Sans plan
- GIVEN un plan vide
- WHEN Coach est ouvert
- THEN aucun score d’adhérence trompeur n’apparaît

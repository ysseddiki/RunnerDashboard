# session-type-trends Specification

## Purpose
TBD

## Requirements

### Requirement: Tendances par type de séance
Le système SHALL agrégér, pour chaque `session_type` ayant au moins 3 activités running éligibles sur 84 jours, des métriques de tendance (allure, FC si dispo, decoupling, cv_pace) en comparant la fenêtre récente (28 j) à la fenêtre antérieure (29–84 j).

#### Scenario: Type avec historique
- **GIVEN** ≥ 3 séances `tempo` sur 84 jours dont au moins une dans les 28 derniers jours
- **WHEN** le client appelle `GET /api/analytics/session-type-trends`
- **THEN** l’entrée `tempo` a `available=true`, des valeurs `recent` / `prior`, un `delta_pct` d’allure et une `direction` parmi `mieux`, `stable`, `moins_bon`, `indetermine`

#### Scenario: Type sous-échantillonné
- **GIVEN** moins de 3 séances d’un type sur 84 jours
- **WHEN** les tendances sont calculées
- **THEN** ce type est omis ou marqué `available=false` avec `reason_fr`

### Requirement: Direction de performance
Le système SHALL interpréter une allure plus rapide (pace_sec_per_km en baisse), un decoupling en baisse et un cv_pace en baisse comme `mieux` pour les types concernés ; une variation d’allure &lt; 1 % est `stable`.

#### Scenario: Amélioration d’allure
- **GIVEN** une allure récente 3 % plus rapide qu’en période antérieure pour `seuil`
- **WHEN** la direction est calculée
- **THEN** `direction` = `mieux` pour la métrique allure

### Requirement: Endpoint tendances
Le système SHALL exposer `GET /api/analytics/session-type-trends` et un résumé `session_type_trends_summary` dans `/api/analytics/overview`.

#### Scenario: Overview résumé
- **GIVEN** au moins une tendance disponible
- **WHEN** l’overview est demandée
- **THEN** `session_type_trends_summary` liste jusqu’à 5 types avec `direction` et `label_fr`

# predictions Specification

## Purpose
Estimer des allures de course et d’entraînement de façon déterministe à partir des activités locales, avec tendances et niveau de confiance.

## Requirements

### Requirement: Endpoint prévisions
Le système SHALL exposer `GET /api/predictions/overview` calculé localement sans appel LLM.

#### Scenario: Réponse structurée
- GIVEN des activités en base
- WHEN le client appelle `/api/predictions/overview`
- THEN la réponse contient estimations distances, allures d’entraînement, tendance 10 km, confiance et warnings

### Requirement: Extrapolation Riegel
Le système SHALL extrapoler les allures entre distances via \(p_2 = p_1 \times (D_2/D_1)^{0.06}\) à partir d’une ancre déterministe.

#### Scenario: Ancre compétition
- GIVEN une compétition récente avec distance connue
- WHEN les prévisions sont calculées
- THEN cette compétition est préférée comme ancre
- AND les allures 5 km / 10 km / semi / marathon en découlent

### Requirement: Confiance et fourchettes
Le système SHALL associer à chaque estimation une confiance (`haute` | `moyenne` | `basse`) et une fourchette basse/haute.

#### Scenario: Peu de données
- GIVEN moins de 5 activités
- WHEN les prévisions sont calculées
- THEN la confiance est `basse`
- AND des warnings FR expliquent le manque de données

### Requirement: Allures d’entraînement
Le système SHALL proposer des allures cibles pour les types de séance connus (EF, seuil, VMA, etc.), observées si tags présents sinon dérivées du 10 km estimé.

#### Scenario: Tags seuil
- GIVEN au moins une sortie taguée `seuil`
- WHEN les allures d’entraînement sont calculées
- THEN l’allure seuil reflète la moyenne observée de ces sorties (échantillon limité récent)

### Requirement: Tendance 12 semaines
Le système SHALL fournir une série hebdomadaire de l’allure 10 km estimée sur jusqu’à 12 semaines.

#### Scenario: Évolution
- GIVEN un historique sur plusieurs semaines
- WHEN l’overview est demandé
- THEN `trend_10k` contient des points `week` + `pace_sec_per_km`

### Requirement: Pas de LLM
Le système MUST NOT utiliser Ollama ni un cloud IA pour produire ces chiffres.

#### Scenario: Isolation
- GIVEN une demande de prévisions
- WHEN le calcul s’exécute
- THEN aucun appel au service Ollama n’est effectué

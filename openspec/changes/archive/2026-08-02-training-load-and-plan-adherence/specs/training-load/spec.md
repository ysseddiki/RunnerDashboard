# training-load Specification

## Purpose

Exposer une charge d’entraînement continue (TRIMP journalier, ATL, CTL, TSB) pour lire la forme et piloter la suite du travail.

## ADDED Requirements

### Requirement: Série de charge journalière
Le système SHALL calculer, pour chaque jour calendaire de la fenêtre demandée, le TRIMP journalier (somme des `trimp_edwards` des activités running éligibles) et les indices ATL (τ≈7), CTL (τ≈42) et TSB (CTL−ATL) de façon déterministe.

#### Scenario: Historique avec TRIMP
- GIVEN au moins 14 jours distincts avec TRIMP non nul sur des activités running
- WHEN `/api/analytics/load-series` (ou équivalent) est demandé
- THEN une série chronologique contenant `date`, `daily_trimp`, `atl`, `ctl`, `tsb` est renvoyée
- AND `available` est vrai

#### Scenario: Données insuffisantes
- GIVEN moins de 14 jours avec TRIMP
- WHEN la série est demandée
- THEN `available` est faux
- AND un `reason_fr` explique le manque sans inventer d’indices

### Requirement: Snapshot de forme courant
Le système SHALL exposer le dernier point de forme (ATL, CTL, TSB) avec un statut parmi `fatigue`, `productif`, `neutre`, `frais` selon des seuils TSB documentés.

#### Scenario: Athlète frais
- GIVEN un TSB courant ≥ 10 et une série disponible
- WHEN l’overview ou le snapshot forme est lu
- THEN `status` vaut `frais`
- AND un libellé FR est fourni

#### Scenario: Fatigue
- GIVEN un TSB courant ≤ −20
- WHEN le snapshot est lu
- THEN `status` vaut `fatigue`

### Requirement: Cohérence avec ACR existant
Le système SHALL conserver les indicateurs `load` TRIMP 7j/28j/ACR déjà exposés et les présenter comme complémentaires à ATL/CTL/TSB (sans les supprimer).

#### Scenario: Overview complète
- GIVEN des features TRIMP calculées
- WHEN `/api/analytics/overview` est demandé
- THEN `load` (ACR) et `form` (ATL/CTL/TSB) sont tous deux présents lorsque disponibles

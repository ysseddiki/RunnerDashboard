# Proposal: apple-health-link

## Why

Les sorties Apple Watch / Forme n’arrivent souvent pas complètes dans Strava (cadence absente).
L’utilisateur a un export Apple Santé et veut lier ou créer des séances sans écraser Strava.

## What Changes

- Import ZIP export Santé (`export.xml`, workouts)
- Table `apple_workouts` + activités multi-source (`strava` | `apple`)
- Matching auto/manuel Strava ; candidats renvoyés à l’import
- Enrichissement des trous uniquement ; sinon création d’activité Apple
- UI Admin import + badge / panneau lien ; OpenSpec ingestion/ui

## Non-goals

- HealthKit live / app iOS
- Import sommeil / pas / tout le XML
- Remplacement de métriques Strava déjà présentes
- Routes GPX Apple sur la carte

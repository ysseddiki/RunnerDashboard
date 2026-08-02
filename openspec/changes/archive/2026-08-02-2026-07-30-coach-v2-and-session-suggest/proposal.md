# Proposal: coach-v2-and-session-suggest

## Why

Le coach renvoie du texte brut peu lisible et sans plan actionnable en tête de page.
Les types de séance restent manuels alors que allure / FC / distance permettent une suggestion.

## What Changes

- Coach v2 : réponse structurée (`summary`, `plan[]`, `markdown`) + rendu markdown UI + calendrier 7–14 j
- Suggestion automatique de `session_type` (règles + option IA locale), validation humaine
- Specs OpenSpec coach + ui (+ ingestion/session)

## Non-goals

- Apple Santé
- Analyse fractionné / récup BPM
- Application auto sans confirmation utilisateur
- Streaming token coach

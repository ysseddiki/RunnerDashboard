# Proposal: p2-weather-enrichment

## Why

Les sorties Strava sont en base (P1). La météo au moment de la course est un facteur
explicatif important : il faut l’attacher à chaque activité lors du Sync.

## What Changes

- Client Open-Meteo (historique / récent) au Sync uniquement
- Stockage météo liée à l’activité (température, ressenti, humidité, précipitations, vent, code)
- Affichage dans le détail UI
- Backfill des activités sans météo au Sync
- Logs FR explicites

## Non-goals

- Analytics corrélation avancées (P3)
- Coach (P4)
- Prévisions futures (hors activité passée)

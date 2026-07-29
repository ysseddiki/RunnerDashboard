# Proposal: p1-strava-ingestion

## Why

Le socle P0 tourne. Il faut maintenant récupérer les sorties running depuis Strava,
les stocker localement (dont cadence PPM si dispo) et les afficher, avec Sync depuis l’UI.

## What Changes

- OAuth Strava (connect / callback / tokens en Postgres)
- Sync UI → import activités + streams utiles
- Endpoints liste / détail activités
- UI : connexion Strava, bouton Sync, liste et détail
- Cadence stockée en PPM ; log explicite si absente

## Non-goals

- Météo (P2), analytics (P3), coach (P4)
- Apple Forme/Santé
- Segments / social Strava

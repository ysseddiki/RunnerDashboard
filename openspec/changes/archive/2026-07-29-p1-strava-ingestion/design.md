# Design: p1-strava-ingestion

## Flux

1. UI « Connecter Strava » → `GET /api/strava/auth-url` → redirect OAuth
2. Callback `GET /api/strava/callback` → échange code → tokens en DB → redirect UI
3. UI « Synchroniser » → `POST /api/strava/sync` (réseau sortant Strava uniquement ici)
4. UI liste/détail → `GET /api/activities` / `GET /api/activities/{id}`

## Données

- `strava_tokens` : athlete_id, access, refresh, expires_at
- `activities` : métadonnées normalisées + `cadence_ppm` nullable + `streams_json` JSONB

## Auth app Strava

Variables : `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_REDIRECT_URI`.
Scope : `activity:read_all,profile:read_all`.

## Logs

Messages FR : sync démarré/terminé, activité importée, cadence absente, erreurs token.

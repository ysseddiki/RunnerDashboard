# Design: apple-health-link

## Import

Upload Admin d’un ZIP export Santé. Parser streaming/iteratif des `<Workout>` (running, walking, hiking). Upsert par `apple_uuid`.

## Matching

Score sur Δstart (≤10 min), Δdistance (≤8 %), Δdurée (≤12 %). Auto-link si confiance haute et candidat unique.

## Enrichissement

Sur lien vers Activity Strava : remplir `cadence_ppm` / FC seulement si null. Unlink ne retire pas les valeurs déjà écrites.

## Activité Apple-only

Sans match (ou promote manuel) : créer `Activity(source=apple, strava_id=null, apple_uuid=…)`.

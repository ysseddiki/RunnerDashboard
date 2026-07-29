# Design: p2-weather-enrichment

## Source

Open-Meteo sans clé API :
- archive `https://archive-api.open-meteo.com/v1/archive` (sorties anciennes)
- forecast `https://api.open-meteo.com/v1/forecast` (sorties récentes, ~5 derniers jours)

Variables horaires : température, ressenti, humidité, précipitations, vent, weather_code.
Sélection de l’heure la plus proche du `start_date` de l’activité.

## Stockage

Colonne `activities.weather_json` (JSONB) + migration légère `ADD COLUMN IF NOT EXISTS`.

## Sync

Après import Strava : enrichir chaque activité créée/mise à jour, puis backfill des lignes sans météo ayant lat/lon.
Skip si indoor / pas de GPS (log explicite).

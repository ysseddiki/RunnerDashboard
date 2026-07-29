export type HealthResponse = {
  status: string
  service: string
  version: string
  palier: string
}

export type StravaStatus = {
  connected: boolean
  athlete_id: number | null
  athlete_name: string | null
  expires_at: number | null
}

export type WeatherInfo = {
  observed_at?: string | null
  temperature_c?: number | null
  apparent_temperature_c?: number | null
  humidity_pct?: number | null
  precipitation_mm?: number | null
  wind_speed_kmh?: number | null
  wind_direction_deg?: number | null
  weather_code?: number | null
  weather_label_fr?: string | null
  source?: string | null
}

export type StreamPayload = {
  data?: number[] | Array<[number, number]>
  original_size?: number
  resolution?: string
}

export type ActivitySummary = {
  id: number
  strava_id: number
  name: string
  sport_type: string | null
  start_date: string | null
  distance_m: number | null
  moving_time_s: number | null
  average_speed_mps: number | null
  average_heartrate: number | null
  cadence_ppm: number | null
  total_elevation_gain_m: number | null
  session_type?: string | null
  session_type_label_fr?: string | null
  weather_json?: WeatherInfo | null
}

export type ActivityDetail = ActivitySummary & {
  elapsed_time_s: number | null
  max_speed_mps: number | null
  max_heartrate: number | null
  average_watts: number | null
  kilojoules: number | null
  calories: number | null
  start_lat: number | null
  start_lng: number | null
  summary_polyline: string | null
  device_name: string | null
  trainer: boolean | null
  timezone: string | null
  activity_type: string | null
  streams_json: Record<string, StreamPayload> | null
  synced_at: string | null
}

export type AnalyticsOverview = {
  category: string
  category_label_fr: string
  reasons: string[]
  totals: {
    activities: number
    distance_km: number
    moving_time_h: number
  }
  window_28d: {
    activities: number
    distance_km: number
    avg_pace_sec_per_km: number | null
    avg_heartrate: number | null
    avg_cadence_ppm: number | null
  }
  previous_28d: {
    activities: number
    distance_km: number
    avg_pace_sec_per_km: number | null
  }
  trends: {
    volume_pct: number | null
    speed_pct: number | null
  }
  weekly_volume: Array<{ week: string; distance_km: number; runs: number }>
  weather: {
    activities_with_weather: number
    avg_temperature_c: number | null
    rainy_runs: number
    rainy_share_pct: number | null
  }
}

export type AppSettings = {
  ollama_model: string
  allowed_ollama_models: string[]
  ollama_model_source: string
}

export type SessionTypeInfo = {
  id: string
  label_fr: string
  description_fr: string
}

export type StreamPoint = {
  index: number
  time_s: number
  distance_m: number
  distance_km: number
  pace_sec_per_km: number | null
  speed_mps: number | null
  heartrate: number | null
  cadence_ppm: number | null
  altitude_m: number | null
  watts: number | null
  lat: number | null
  lng: number | null
}

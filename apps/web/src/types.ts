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
  strava_id: number | null
  source?: string
  source_label_fr?: string
  apple_uuid?: string | null
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
  coach_analysis_json?: {
    model?: string
    summary?: string
    markdown?: string
    hints?: Array<{ title: string; text: string }>
    session_type?: string | null
  } | null
  coach_analyzed_at?: string | null
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

export type PredictionsOverview = {
  available: boolean
  confidence: string
  confidence_label_fr: string
  hero_distance_id: string
  estimates: Array<{
    id: string
    label_fr: string
    distance_km: number
    pace_sec_per_km: number
    pace_low_sec_per_km: number
    pace_high_sec_per_km: number
    finish_time_s: number
    confidence: string
  }>
  training_paces: Array<{
    session_type: string
    label_fr: string
    pace_sec_per_km: number
    source: string
    sample_size: number
  }>
  trend_10k: Array<{ week: string; pace_sec_per_km: number }>
  anchor: {
    activity_id: number
    name: string
    start_date: string | null
    distance_km: number
    pace_sec_per_km: number
    session_type: string | null
    session_type_label_fr: string | null
    method: string
    charge_factor: number
  } | null
  reasons: string[]
  warnings: string[]
  activities_considered: number
}

export type AppleWorkout = {
  id: number
  apple_uuid: string
  workout_type: string | null
  workout_type_label_fr?: string | null
  start_date: string | null
  end_date: string | null
  duration_s: number | null
  distance_m: number | null
  avg_hr: number | null
  max_hr: number | null
  energy_kcal: number | null
  cadence_ppm: number | null
  activity_id: number | null
  imported_at: string | null
}

export type AppleMatchCandidate = {
  activity_id: number
  activity_name: string
  strava_id: number | null
  start_date: string | null
  distance_m: number | null
  score: number
  confidence: string
  reasons_fr: string[]
}

export type AppleImportItem = {
  workout: AppleWorkout
  candidates: AppleMatchCandidate[]
  action: string
  enriched_fields: string[]
}

export type AppleImportResult = {
  imported: number
  updated: number
  auto_linked: number
  promoted: number
  total: number
  items: AppleImportItem[]
  message: string
}


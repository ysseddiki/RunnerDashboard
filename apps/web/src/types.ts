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
  terrain?: string | null
  terrain_label_fr?: string | null
  weather_json?: WeatherInfo | null
}

export type ActivityFeatures = {
  schema_version: number
  computed_at?: string
  profile_fingerprint?: string
  input_fingerprint?: string
  quality_flags?: {
    has_hr?: boolean
    has_streams?: boolean
    has_gps?: boolean
    running_eligible?: boolean
  }
  unavailable?: Array<{ key: string; reason_fr: string }>
  splits_km?: Array<{
    km: number
    distance_m: number
    duration_s: number
    pace_sec_per_km: number | null
    avg_hr: number | null
    avg_cadence_ppm: number | null
  }> | null
  time_in_zone?: Record<
    string,
    { seconds: number; pct: number; minutes: number }
  > | null
  trimp_edwards?: number | null
  decoupling_pct?: number | null
  cv_pace?: number | null
  cv_hr?: number | null
  intervals?: {
    confidence: string
    count: number
    reps: Array<{
      kind: string
      start_distance_m: number
      end_distance_m: number
      duration_s: number
      distance_m: number
      pace_sec_per_km: number | null
      avg_hr: number | null
    }>
  } | null
  session?: {
    family?: string
    pct_z1_z2?: number | null
    pct_above_z2?: number | null
    decoupling_pct?: number | null
    split_delta_sec_per_km?: number | null
    cv_pace?: number | null
    regularity?: string | null
    intervals?: ActivityFeatures['intervals']
    even_pacing_cv?: number | null
    climb_sample_count?: number
  }
  chart_overlays?: {
    zones_summary?: Record<string, { seconds: number; pct: number; minutes: number }>
    interval_segments?: Array<{
      start_distance_m: number
      end_distance_m: number
      kind: string
    }>
  } | null
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
  features_json?: ActivityFeatures | null
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

export type FormSnapshot = {
  available: boolean
  atl?: number | null
  ctl?: number | null
  tsb?: number | null
  status?: string | null
  status_label_fr?: string | null
  warmup?: boolean
  warmup_note_fr?: string | null
  as_of?: string | null
  reason_fr?: string | null
}

export type LoadSeriesPoint = {
  date: string
  daily_trimp: number
  atl: number
  ctl: number
  tsb: number
}

export type LoadSeriesResponse = {
  available: boolean
  days: number
  series: LoadSeriesPoint[]
  form: FormSnapshot | null
  trimp_day_count?: number
  warmup?: boolean
  reason_fr?: string | null
}

export type AdherenceItem = {
  date: string
  session_type: string | null
  session_type_label_fr?: string | null
  title: string | null
  details?: string | null
  target_pace?: string | null
  duration_or_distance?: string | null
  status: 'matched' | 'missed' | 'upcoming' | string
  activity_id?: number | null
  activity_name?: string | null
  confidence?: string | null
  type_match?: boolean | null
}

export type PlanAdherence = {
  available: boolean
  adherence_pct: number | null
  matched: number
  missed: number
  upcoming: number
  planned_past: number
  type_mismatch?: number
  items: AdherenceItem[]
  missed_titles?: string[]
  warnings_fr?: string[]
  reason_fr?: string | null
  plan_updated_at?: string | null
}

export type NextSessionItem = {
  date: string
  session_type: string
  title_fr: string
  duration_or_distance: string
  target_pace_sec_per_km: number | null
  rationale_fr: string
  source: string
}

export type NextSessionsResponse = {
  available: boolean
  sessions: NextSessionItem[]
  horizon_days?: number
  form_status?: string | null
  acr_elevated?: boolean
  notes_fr?: string[]
  reason_fr?: string | null
}

export type SessionTypeTrend = {
  session_type: string
  label_fr: string
  available: boolean
  reason_fr?: string | null
  sample_recent?: number
  sample_prior?: number
  recent?: Record<string, number | null>
  prior?: Record<string, number | null>
  pace_delta_pct?: number | null
  direction?: 'mieux' | 'stable' | 'moins_bon' | 'indetermine' | null
  directions?: Record<string, string>
}

export type SessionTypeTrendsSummary = {
  available: boolean
  items: Array<{
    session_type: string
    label_fr: string
    direction: string | null
    pace_delta_pct: number | null
    sample_recent?: number
  }>
  reason_fr?: string | null
}

export type SessionTypeTrendsResponse = {
  available: boolean
  days: number
  recent_days: number
  trends: SessionTypeTrend[]
  reason_fr?: string | null
}

export type AnalyticsOverview = {
  category: string
  category_label_fr: string
  reasons: string[]
  totals: {
    activities: number
    distance_km: number
    moving_time_h: number
    elevation_gain_m?: number
  }
  window_28d: {
    activities: number
    distance_km: number
    avg_pace_sec_per_km: number | null
    avg_heartrate: number | null
    avg_max_heartrate?: number | null
    avg_cadence_ppm: number | null
    elevation_gain_m?: number
  }
  previous_28d: {
    activities: number
    distance_km: number
    avg_pace_sec_per_km: number | null
    avg_heartrate?: number | null
    avg_cadence_ppm?: number | null
  }
  deltas?: {
    pace_gain_sec_per_km: number | null
    heartrate_bpm: number | null
    volume_pct: number | null
    speed_pct: number | null
  }
  trends: {
    volume_pct: number | null
    speed_pct: number | null
  }
  insight_notes_fr?: string[]
  weekly_volume: Array<{ week: string; distance_km: number; runs: number }>
  running_eligible_count?: number
  volume_easy_km_28d?: number
  volume_quality_km_28d?: number
  volume_untagged_km_28d?: number
  load?: {
    available: boolean
    trimp_7d: number | null
    trimp_28d: number | null
    acr: number | null
    acr_elevated?: boolean
    reason_fr?: string | null
    sample_with_trimp?: number
  }
  form?: FormSnapshot
  next_sessions?: NextSessionsResponse
  session_type_trends_summary?: SessionTypeTrendsSummary
  weather: {
    activities_with_weather: number
    avg_temperature_c: number | null
    rainy_runs: number
    rainy_share_pct: number | null
  }
  hr_weather?: {
    available: boolean
    sample_size: number
    eligible_with_hr_weather: number
    pace_band_sec_per_km: { low: number; high: number; center: number } | null
    pace_band_label_fr: string | null
    buckets: Array<{
      id: string
      label_fr: string
      n: number
      avg_hr: number | null
      avg_temp_c: number | null
    }>
    hr_delta_warm_vs_cool_bpm: number | null
    slope_bpm_per_c: number | null
    confidence: string
    confidence_label_fr: string
    notes_fr: string[]
    filters_fr: string
    reason_fr: string | null
  }
}

export type AppSettings = {
  ollama_model: string
  allowed_ollama_models: string[]
  ollama_model_source: string
  ollama_num_thread?: string
  ollama_num_thread_effective?: number | null
  ollama_num_thread_source?: string
  cpu_count?: number
}

export type SessionTypeInfo = {
  id: string
  label_fr: string
  description_fr: string
}

export type TerrainInfo = {
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
    terrain?: string | null
    terrain_label_fr?: string | null
    method: string
    charge_factor: number
  } | null
  reasons: string[]
  warnings: string[]
  activities_considered: number
  insights?: AnalyticsOverview | null
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

export type CompareDirection = 'mieux' | 'stable' | 'moins_bon' | 'indetermine'

export type CompareActivityCard = {
  id: number
  name: string
  start_date: string | null
  distance_m: number | null
  moving_time_s: number | null
  average_speed_mps: number | null
  average_heartrate: number | null
  cadence_ppm: number | null
  total_elevation_gain_m: number | null
  session_type: string | null
  session_type_label_fr: string | null
  terrain: string | null
}

export type CompareMetric = {
  key: string
  label_fr: string
  value_a: number | null
  value_b: number | null
  display_a: string
  display_b: string
  delta: number | null
  delta_display_fr: string | null
  direction: CompareDirection
  note_fr: string | null
}

export type CompareActivitiesResponse = {
  activity_a: CompareActivityCard
  activity_b: CompareActivityCard
  days_between: number | null
  interval_label_fr: string
  intro_fr: string
  headline_fr: string
  overall_direction: CompareDirection
  overall_summary_fr: string
  metrics: CompareMetric[]
  caveats_fr: string[]
  distances_comparable: boolean
  same_session_type: boolean
}


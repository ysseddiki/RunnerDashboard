import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'

type HealthResponse = {
  status: string
  service: string
  version: string
  palier: string
}

type StravaStatus = {
  connected: boolean
  athlete_id: number | null
  athlete_name: string | null
  expires_at: number | null
}

type WeatherInfo = {
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

type ActivitySummary = {
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
  weather_json?: WeatherInfo | null
}

type ActivityDetail = ActivitySummary & {
  elapsed_time_s: number | null
  max_heartrate: number | null
  average_watts: number | null
  calories: number | null
  device_name: string | null
}

function formatKm(meters: number | null): string {
  if (meters == null) return '—'
  return `${(meters / 1000).toFixed(2)} km`
}

function formatDuration(seconds: number | null): string {
  if (seconds == null) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  return `${m}m ${String(s).padStart(2, '0')}s`
}

function formatPace(mps: number | null): string {
  if (mps == null || mps <= 0) return '—'
  const secPerKm = 1000 / mps
  const mm = Math.floor(secPerKm / 60)
  const ss = Math.round(secPerKm % 60)
  return `${mm}:${String(ss).padStart(2, '0')} /km`
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleString('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function formatPaceSec(secPerKm: number | null | undefined): string {
  if (secPerKm == null || secPerKm <= 0) return '—'
  const mm = Math.floor(secPerKm / 60)
  const ss = Math.round(secPerKm % 60)
  return `${mm}:${String(ss).padStart(2, '0')} /km`
}

type AnalyticsOverview = {
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

function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [strava, setStrava] = useState<StravaStatus | null>(null)
  const [activities, setActivities] = useState<ActivitySummary[]>([])
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<ActivityDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const queryMessage = useMemo(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('strava') === 'connected') return 'Compte Strava connecté.'
    if (params.get('strava') === 'error') {
      return `Connexion Strava échouée (${params.get('reason') ?? 'inconnu'}).`
    }
    return null
  }, [])

  const refresh = useCallback(async () => {
    setError(null)
    const [healthRes, statusRes, listRes, analyticsRes] = await Promise.all([
      fetch('/api/health'),
      fetch('/api/strava/status'),
      fetch('/api/activities?limit=50'),
      fetch('/api/analytics/overview'),
    ])
    if (!healthRes.ok) throw new Error(`Health HTTP ${healthRes.status}`)
    if (!statusRes.ok) throw new Error(`Status Strava HTTP ${statusRes.status}`)
    if (!listRes.ok) throw new Error(`Activités HTTP ${listRes.status}`)
    if (!analyticsRes.ok) throw new Error(`Analytics HTTP ${analyticsRes.status}`)
    setHealth((await healthRes.json()) as HealthResponse)
    setStrava((await statusRes.json()) as StravaStatus)
    setActivities((await listRes.json()) as ActivitySummary[])
    setAnalytics((await analyticsRes.json()) as AnalyticsOverview)
  }, [])

  useEffect(() => {
    void refresh().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'Chargement impossible')
    })
  }, [refresh])

  useEffect(() => {
    if (selectedId == null) {
      setDetail(null)
      return
    }
    let cancelled = false
    void fetch(`/api/activities/${selectedId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Détail HTTP ${res.status}`)
        return (await res.json()) as ActivityDetail
      })
      .then((data) => {
        if (!cancelled) setDetail(data)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Détail impossible')
        }
      })
    return () => {
      cancelled = true
    }
  }, [selectedId])

  async function connectStrava() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/strava/auth-url')
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { detail?: string } | null
        throw new Error(body?.detail ?? `Auth URL HTTP ${res.status}`)
      }
      const data = (await res.json()) as { url: string }
      window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connexion impossible')
      setBusy(false)
    }
  }

  async function runSync() {
    setBusy(true)
    setSyncMessage(null)
    setError(null)
    try {
      const res = await fetch('/api/strava/sync', { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(
          typeof body.detail === 'string' ? body.detail : `Sync HTTP ${res.status}`,
        )
      }
      setSyncMessage(body.message as string)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync impossible')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="page">
      <header className="brand">
        <p className="eyebrow">RunningDashboard</p>
        <h1>Palier P3 — Évolution</h1>
        <p className="lede">
          Volumes, tendances d’allure et catégorie d’évolution à partir de vos
          sorties Strava et de la météo associée.
        </p>
      </header>

      <section className="status" aria-live="polite">
        <h2>État</h2>
        {error && <p className="error">{error}</p>}
        {queryMessage && <p className="ok">{queryMessage}</p>}
        {syncMessage && <p className="ok">{syncMessage}</p>}
        {health && (
          <ul>
            <li>API : {health.status} ({health.palier})</li>
            <li>
              Strava :{' '}
              {strava?.connected
                ? `connecté${strava.athlete_name ? ` — ${strava.athlete_name}` : ''}`
                : 'non connecté'}
            </li>
          </ul>
        )}
        <div className="actions">
          {!strava?.connected ? (
            <button type="button" onClick={() => void connectStrava()} disabled={busy}>
              Connecter Strava
            </button>
          ) : (
            <button type="button" onClick={() => void runSync()} disabled={busy}>
              {busy ? 'Synchronisation…' : 'Synchroniser'}
            </button>
          )}
        </div>
      </section>

      {analytics && (
        <section className="evolution">
          <h2>Évolution</h2>
          <p className={`category cat-${analytics.category}`}>
            {analytics.category_label_fr}
          </p>
          <ul className="reasons">
            {analytics.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
          <div className="metrics">
            <div>
              <h3>Total</h3>
              <ul>
                <li>{analytics.totals.activities} sorties</li>
                <li>{analytics.totals.distance_km} km</li>
                <li>{analytics.totals.moving_time_h} h</li>
              </ul>
            </div>
            <div>
              <h3>28 derniers jours</h3>
              <ul>
                <li>{analytics.window_28d.activities} sorties · {analytics.window_28d.distance_km} km</li>
                <li>Allure : {formatPaceSec(analytics.window_28d.avg_pace_sec_per_km)}</li>
                <li>
                  FC :{' '}
                  {analytics.window_28d.avg_heartrate != null
                    ? `${analytics.window_28d.avg_heartrate} bpm`
                    : '—'}
                </li>
                <li>
                  Cadence :{' '}
                  {analytics.window_28d.avg_cadence_ppm != null
                    ? `${analytics.window_28d.avg_cadence_ppm} PPM`
                    : '—'}
                </li>
              </ul>
            </div>
            <div>
              <h3>Tendances vs 28 j avant</h3>
              <ul>
                <li>
                  Volume :{' '}
                  {analytics.trends.volume_pct != null
                    ? `${analytics.trends.volume_pct > 0 ? '+' : ''}${analytics.trends.volume_pct} %`
                    : '—'}
                </li>
                <li>
                  Vitesse :{' '}
                  {analytics.trends.speed_pct != null
                    ? `${analytics.trends.speed_pct > 0 ? '+' : ''}${analytics.trends.speed_pct} %`
                    : '—'}
                </li>
              </ul>
            </div>
          </div>
          {analytics.weekly_volume.length > 0 && (
            <>
              <h3>Volume hebdomadaire</h3>
              <ul className="weeks">
                {analytics.weekly_volume.slice(-8).map((w) => (
                  <li key={w.week}>
                    {w.week} : {w.distance_km} km ({w.runs} sortie{w.runs > 1 ? 's' : ''})
                  </li>
                ))}
              </ul>
            </>
          )}
          <h3>Météo (historique enrichi)</h3>
          <ul>
            <li>{analytics.weather.activities_with_weather} sorties avec météo</li>
            <li>
              Temp. moyenne :{' '}
              {analytics.weather.avg_temperature_c != null
                ? `${analytics.weather.avg_temperature_c} °C`
                : '—'}
            </li>
            <li>
              Sorties sous pluie : {analytics.weather.rainy_runs}
              {analytics.weather.rainy_share_pct != null
                ? ` (${analytics.weather.rainy_share_pct} %)`
                : ''}
            </li>
          </ul>
        </section>
      )}

      <section className="activities">
        <h2>Activités</h2>
        {activities.length === 0 ? (
          <p>Aucune sortie pour l’instant. Connectez Strava puis lancez Sync.</p>
        ) : (
          <ul className="activity-list">
            {activities.map((activity) => (
              <li key={activity.id}>
                <button
                  type="button"
                  className={selectedId === activity.id ? 'activity active' : 'activity'}
                  onClick={() => setSelectedId(activity.id)}
                >
                  <strong>{activity.name}</strong>
                  <span>
                    {formatDate(activity.start_date)} · {formatKm(activity.distance_m)} ·{' '}
                    {formatPace(activity.average_speed_mps)}
                    {activity.weather_json?.temperature_c != null
                      ? ` · ${Math.round(activity.weather_json.temperature_c)}°C`
                      : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {detail && (
        <section className="detail">
          <h2>{detail.name}</h2>
          <ul>
            <li>Date : {formatDate(detail.start_date)}</li>
            <li>Distance : {formatKm(detail.distance_m)}</li>
            <li>Durée : {formatDuration(detail.moving_time_s)}</li>
            <li>Allure : {formatPace(detail.average_speed_mps)}</li>
            <li>FC moy. : {detail.average_heartrate ?? '—'} bpm</li>
            <li>Cadence : {detail.cadence_ppm != null ? `${detail.cadence_ppm} PPM` : '—'}</li>
            <li>D+ : {detail.total_elevation_gain_m != null ? `${Math.round(detail.total_elevation_gain_m)} m` : '—'}</li>
            <li>Appareil : {detail.device_name ?? '—'}</li>
          </ul>
          <h3>Météo</h3>
          {detail.weather_json ? (
            <ul>
              <li>Conditions : {detail.weather_json.weather_label_fr ?? '—'}</li>
              <li>
                Température :{' '}
                {detail.weather_json.temperature_c != null
                  ? `${detail.weather_json.temperature_c} °C`
                  : '—'}
                {detail.weather_json.apparent_temperature_c != null
                  ? ` (ressenti ${detail.weather_json.apparent_temperature_c} °C)`
                  : ''}
              </li>
              <li>
                Humidité :{' '}
                {detail.weather_json.humidity_pct != null
                  ? `${detail.weather_json.humidity_pct} %`
                  : '—'}
              </li>
              <li>
                Précipitations :{' '}
                {detail.weather_json.precipitation_mm != null
                  ? `${detail.weather_json.precipitation_mm} mm`
                  : '—'}
              </li>
              <li>
                Vent :{' '}
                {detail.weather_json.wind_speed_kmh != null
                  ? `${detail.weather_json.wind_speed_kmh} km/h`
                  : '—'}
              </li>
            </ul>
          ) : (
            <p>Pas de météo (GPS manquant, indoor, ou pas encore synchronisée).</p>
          )}
        </section>
      )}
    </main>
  )
}

export default App

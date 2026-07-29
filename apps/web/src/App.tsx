import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'

type View = 'home' | 'activities' | 'detail'

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

type StreamPayload = {
  data?: number[] | Array<[number, number]>
  original_size?: number
  resolution?: string
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

function formatKm(meters: number | null | undefined): string {
  if (meters == null) return '—'
  return `${(meters / 1000).toFixed(2)} km`
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
  return `${m}m ${String(s).padStart(2, '0')}s`
}

function formatPace(mps: number | null | undefined): string {
  if (mps == null || mps <= 0) return '—'
  const secPerKm = 1000 / mps
  const mm = Math.floor(secPerKm / 60)
  const ss = Math.round(secPerKm % 60)
  return `${mm}:${String(ss).padStart(2, '0')} /km`
}

function formatDate(value: string | null | undefined): string {
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

function formatTrend(value: number | null | undefined): string {
  if (value == null) return '—'
  return `${value > 0 ? '+' : ''}${value} %`
}

function numericStream(stream: StreamPayload | undefined): number[] {
  if (!stream?.data?.length) return []
  const first = stream.data[0]
  if (typeof first === 'number') return stream.data as number[]
  return []
}

function downsample(values: number[], maxPoints = 80): number[] {
  if (values.length <= maxPoints) return values
  const step = values.length / maxPoints
  const out: number[] = []
  for (let i = 0; i < maxPoints; i += 1) {
    out.push(values[Math.floor(i * step)]!)
  }
  return out
}

function Sparkline({ values, label }: { values: number[]; label: string }) {
  const points = downsample(values)
  if (points.length < 2) return null
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1
  const w = 320
  const h = 64
  const path = points
    .map((v, i) => {
      const x = (i / (points.length - 1)) * w
      const y = h - ((v - min) / range) * (h - 8) - 4
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <div className="spark">
      <div className="spark-head">
        <span>{label}</span>
        <span>
          {min.toFixed(0)} → {max.toFixed(0)}
        </span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label}>
        <path d={path} fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
    </div>
  )
}

function App() {
  const [view, setView] = useState<View>('home')
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [strava, setStrava] = useState<StravaStatus | null>(null)
  const [activities, setActivities] = useState<ActivitySummary[]>([])
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<ActivityDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
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
      fetch('/api/activities?limit=100'),
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
    if (selectedId == null || view !== 'detail') {
      return
    }
    let cancelled = false
    setDetailLoading(true)
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
      .finally(() => {
        if (!cancelled) setDetailLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedId, view])

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

  function openActivity(id: number) {
    setSelectedId(id)
    setDetail(null)
    setView('detail')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function goHome() {
    setView('home')
    setSelectedId(null)
  }

  function goActivities() {
    setView('activities')
    setSelectedId(null)
  }

  const hrStream = numericStream(detail?.streams_json?.heartrate)
  const cadenceStream = numericStream(detail?.streams_json?.cadence)
  const altitudeStream = numericStream(detail?.streams_json?.altitude)
  const velocityStream = numericStream(detail?.streams_json?.velocity_smooth)

  return (
    <div className="shell">
      <header className="topbar">
        <button type="button" className="brand-btn" onClick={goHome}>
          RunningDashboard
        </button>
        <nav className="nav" aria-label="Navigation principale">
          <button
            type="button"
            className={view === 'home' ? 'nav-link active' : 'nav-link'}
            onClick={goHome}
          >
            Accueil
          </button>
          <button
            type="button"
            className={view === 'activities' || view === 'detail' ? 'nav-link active' : 'nav-link'}
            onClick={goActivities}
          >
            Activités
          </button>
        </nav>
        <div className="top-actions">
          {strava?.connected ? (
            <button type="button" className="btn" onClick={() => void runSync()} disabled={busy}>
              {busy ? 'Sync…' : 'Synchroniser'}
            </button>
          ) : (
            <button
              type="button"
              className="btn"
              onClick={() => void connectStrava()}
              disabled={busy}
            >
              Connecter Strava
            </button>
          )}
        </div>
      </header>

      <main className="page">
        {error && <p className="banner error">{error}</p>}
        {queryMessage && <p className="banner ok">{queryMessage}</p>}
        {syncMessage && <p className="banner ok">{syncMessage}</p>}

        {view === 'home' && (
          <>
            <section className="hero">
              <h1>Votre suivi running</h1>
              <p>
                {strava?.connected
                  ? `Connecté${strava.athlete_name ? ` — ${strava.athlete_name}` : ''}.`
                  : 'Connectez Strava pour importer vos sorties.'}{' '}
                {health ? `API ${health.status} (${health.palier}).` : ''}
              </p>
            </section>

            {analytics && (
              <section className="panel evolution">
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
                  <div className="metric-card">
                    <h3>Total</h3>
                    <p className="metric-value">{analytics.totals.distance_km} km</p>
                    <p className="metric-sub">
                      {analytics.totals.activities} sorties · {analytics.totals.moving_time_h} h
                    </p>
                  </div>
                  <div className="metric-card">
                    <h3>28 jours</h3>
                    <p className="metric-value">{analytics.window_28d.distance_km} km</p>
                    <p className="metric-sub">
                      Allure {formatPaceSec(analytics.window_28d.avg_pace_sec_per_km)}
                    </p>
                  </div>
                  <div className="metric-card">
                    <h3>Tendances</h3>
                    <p className="metric-value">{formatTrend(analytics.trends.volume_pct)}</p>
                    <p className="metric-sub">
                      Volume · vitesse {formatTrend(analytics.trends.speed_pct)}
                    </p>
                  </div>
                </div>
                {analytics.weekly_volume.length > 0 && (
                  <>
                    <h3>Volume hebdomadaire</h3>
                    <ul className="weeks">
                      {analytics.weekly_volume.slice(-8).map((w) => (
                        <li key={w.week}>
                          <span>{w.week}</span>
                          <strong>
                            {w.distance_km} km · {w.runs} sortie{w.runs > 1 ? 's' : ''}
                          </strong>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                <h3>Météo</h3>
                <p className="muted">
                  {analytics.weather.activities_with_weather} sorties enrichies
                  {analytics.weather.avg_temperature_c != null
                    ? ` · ${analytics.weather.avg_temperature_c} °C en moyenne`
                    : ''}
                  {analytics.weather.rainy_share_pct != null
                    ? ` · ${analytics.weather.rainy_share_pct} % sous pluie`
                    : ''}
                </p>
              </section>
            )}

            <section className="panel">
              <div className="panel-head">
                <h2>Dernières sorties</h2>
                <button type="button" className="linkish" onClick={goActivities}>
                  Tout voir
                </button>
              </div>
              {activities.length === 0 ? (
                <p className="muted">Aucune sortie. Connectez Strava puis synchronisez.</p>
              ) : (
                <ul className="activity-list">
                  {activities.slice(0, 5).map((activity) => (
                    <li key={activity.id}>
                      <button
                        type="button"
                        className="activity"
                        onClick={() => openActivity(activity.id)}
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
          </>
        )}

        {view === 'activities' && (
          <section className="panel">
            <h2>Toutes les activités</h2>
            <p className="muted">Cliquez une sortie pour ouvrir le détail complet.</p>
            {activities.length === 0 ? (
              <p className="muted">Aucune sortie synchronisée.</p>
            ) : (
              <ul className="activity-list">
                {activities.map((activity) => (
                  <li key={activity.id}>
                    <button
                      type="button"
                      className="activity"
                      onClick={() => openActivity(activity.id)}
                    >
                      <strong>{activity.name}</strong>
                      <span>
                        {formatDate(activity.start_date)} · {formatKm(activity.distance_m)} ·{' '}
                        {formatPace(activity.average_speed_mps)}
                        {activity.average_heartrate != null
                          ? ` · ${Math.round(activity.average_heartrate)} bpm`
                          : ''}
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
        )}

        {view === 'detail' && (
          <section className="panel detail-view">
            <button type="button" className="linkish back" onClick={goActivities}>
              ← Retour aux activités
            </button>
            {detailLoading && <p className="muted">Chargement du détail…</p>}
            {!detailLoading && detail && (
              <>
                <header className="detail-hero">
                  <p className="eyebrow-sm">{detail.sport_type ?? detail.activity_type ?? 'Course'}</p>
                  <h1>{detail.name}</h1>
                  <p className="muted">{formatDate(detail.start_date)}</p>
                </header>

                <div className="stat-grid">
                  <div className="stat">
                    <span>Distance</span>
                    <strong>{formatKm(detail.distance_m)}</strong>
                  </div>
                  <div className="stat">
                    <span>Durée (moving)</span>
                    <strong>{formatDuration(detail.moving_time_s)}</strong>
                  </div>
                  <div className="stat">
                    <span>Allure moy.</span>
                    <strong>{formatPace(detail.average_speed_mps)}</strong>
                  </div>
                  <div className="stat">
                    <span>D+</span>
                    <strong>
                      {detail.total_elevation_gain_m != null
                        ? `${Math.round(detail.total_elevation_gain_m)} m`
                        : '—'}
                    </strong>
                  </div>
                </div>

                <h3>Performance</h3>
                <dl className="kv">
                  <div>
                    <dt>Durée totale</dt>
                    <dd>{formatDuration(detail.elapsed_time_s)}</dd>
                  </div>
                  <div>
                    <dt>Vitesse max</dt>
                    <dd>{formatPace(detail.max_speed_mps)}</dd>
                  </div>
                  <div>
                    <dt>FC moyenne</dt>
                    <dd>
                      {detail.average_heartrate != null
                        ? `${Math.round(detail.average_heartrate)} bpm`
                        : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt>FC max</dt>
                    <dd>
                      {detail.max_heartrate != null ? `${Math.round(detail.max_heartrate)} bpm` : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt>Cadence</dt>
                    <dd>
                      {detail.cadence_ppm != null ? `${detail.cadence_ppm} PPM` : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt>Puissance moy.</dt>
                    <dd>
                      {detail.average_watts != null ? `${Math.round(detail.average_watts)} W` : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt>Calories</dt>
                    <dd>
                      {detail.calories != null ? `${Math.round(detail.calories)} kcal` : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt>Travail</dt>
                    <dd>
                      {detail.kilojoules != null ? `${Math.round(detail.kilojoules)} kJ` : '—'}
                    </dd>
                  </div>
                </dl>

                <h3>Contexte</h3>
                <dl className="kv">
                  <div>
                    <dt>Appareil</dt>
                    <dd>{detail.device_name ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>Indoor</dt>
                    <dd>{detail.trainer ? 'Oui' : 'Non'}</dd>
                  </div>
                  <div>
                    <dt>Fuseau</dt>
                    <dd>{detail.timezone ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>GPS départ</dt>
                    <dd>
                      {detail.start_lat != null && detail.start_lng != null
                        ? `${detail.start_lat.toFixed(5)}, ${detail.start_lng.toFixed(5)}`
                        : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt>Strava ID</dt>
                    <dd>{detail.strava_id}</dd>
                  </div>
                  <div>
                    <dt>Sync</dt>
                    <dd>{formatDate(detail.synced_at)}</dd>
                  </div>
                </dl>

                <h3>Météo</h3>
                {detail.weather_json ? (
                  <dl className="kv">
                    <div>
                      <dt>Conditions</dt>
                      <dd>{detail.weather_json.weather_label_fr ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>Température</dt>
                      <dd>
                        {detail.weather_json.temperature_c != null
                          ? `${detail.weather_json.temperature_c} °C`
                          : '—'}
                        {detail.weather_json.apparent_temperature_c != null
                          ? ` (ressenti ${detail.weather_json.apparent_temperature_c} °C)`
                          : ''}
                      </dd>
                    </div>
                    <div>
                      <dt>Humidité</dt>
                      <dd>
                        {detail.weather_json.humidity_pct != null
                          ? `${detail.weather_json.humidity_pct} %`
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt>Précipitations</dt>
                      <dd>
                        {detail.weather_json.precipitation_mm != null
                          ? `${detail.weather_json.precipitation_mm} mm`
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt>Vent</dt>
                      <dd>
                        {detail.weather_json.wind_speed_kmh != null
                          ? `${detail.weather_json.wind_speed_kmh} km/h`
                          : '—'}
                        {detail.weather_json.wind_direction_deg != null
                          ? ` · ${Math.round(detail.weather_json.wind_direction_deg)}°`
                          : ''}
                      </dd>
                    </div>
                    <div>
                      <dt>Relevé</dt>
                      <dd>{detail.weather_json.observed_at ?? '—'}</dd>
                    </div>
                  </dl>
                ) : (
                  <p className="muted">
                    Pas de météo (GPS manquant, indoor, ou pas encore synchronisée).
                  </p>
                )}

                <h3>Séries (streams)</h3>
                {detail.streams_json ? (
                  <div className="sparks">
                    {hrStream.length > 0 && <Sparkline values={hrStream} label="Fréquence cardiaque" />}
                    {cadenceStream.length > 0 && (
                      <Sparkline values={cadenceStream} label="Cadence" />
                    )}
                    {altitudeStream.length > 0 && (
                      <Sparkline values={altitudeStream} label="Altitude (m)" />
                    )}
                    {velocityStream.length > 0 && (
                      <Sparkline values={velocityStream} label="Vitesse (m/s)" />
                    )}
                    {hrStream.length === 0 &&
                      cadenceStream.length === 0 &&
                      altitudeStream.length === 0 &&
                      velocityStream.length === 0 && (
                        <p className="muted">Streams présents mais sans séries numériques affichables.</p>
                      )}
                  </div>
                ) : (
                  <p className="muted">Aucun stream stocké pour cette sortie.</p>
                )}
              </>
            )}
          </section>
        )}
      </main>
    </div>
  )
}

export default App

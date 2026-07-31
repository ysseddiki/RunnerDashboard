import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import type {
  ActivitySummary,
  AnalyticsOverview,
  LoadSeriesResponse,
  StravaStatus,
} from '../types'
import { formatPaceSec, formatTrend } from '../format'
import { ActivityRow } from '../components/ActivityRow'
import { WeeklyVolumeChart } from '../components/WeeklyVolumeChart'
import { FormChart } from '../components/FormChart'
import { apiFetch } from '../auth'

function trendClass(value: number | null | undefined): string {
  if (value == null || value === 0) return ''
  return value > 0 ? 'trend-up' : 'trend-down'
}

export function HomePage() {
  const [strava, setStrava] = useState<StravaStatus | null>(null)
  const [activities, setActivities] = useState<ActivitySummary[]>([])
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null)
  const [loadSeries, setLoadSeries] = useState<LoadSeriesResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [syncBusy, setSyncBusy] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)

  function loadHome() {
    return Promise.all([
      apiFetch('/api/strava/status'),
      apiFetch('/api/activities?limit=100'),
      apiFetch('/api/analytics/overview'),
      apiFetch('/api/analytics/load-series?days=84'),
    ]).then(async ([statusRes, listRes, analyticsRes, seriesRes]) => {
      if (!statusRes.ok) throw new Error(`Status Strava HTTP ${statusRes.status}`)
      if (!listRes.ok) throw new Error(`Activités HTTP ${listRes.status}`)
      if (!analyticsRes.ok) throw new Error(`Analytics HTTP ${analyticsRes.status}`)
      const [s, a, an] = await Promise.all([
        statusRes.json() as Promise<StravaStatus>,
        listRes.json() as Promise<ActivitySummary[]>,
        analyticsRes.json() as Promise<AnalyticsOverview>,
      ])
      let series: LoadSeriesResponse | null = null
      if (seriesRes.ok) {
        series = (await seriesRes.json()) as LoadSeriesResponse
      }
      setStrava(s)
      setActivities(a)
      setAnalytics(an)
      setLoadSeries(series)
    })
  }

  useEffect(() => {
    let cancelled = false
    void loadHome().catch((err: unknown) => {
      if (!cancelled) setError(err instanceof Error ? err.message : 'Chargement impossible')
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function runSync() {
    setSyncBusy(true)
    setSyncMessage(null)
    setError(null)
    try {
      const res = await apiFetch('/api/strava/sync', { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(
          typeof body.detail === 'string' ? body.detail : `Sync HTTP ${res.status}`,
        )
      }
      setSyncMessage(typeof body.message === 'string' ? body.message : 'Sync terminée.')
      await loadHome()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync impossible')
    } finally {
      setSyncBusy(false)
    }
  }

  return (
    <>
      {error && <p className="banner error">{error}</p>}
      {syncMessage && <p className="banner ok">{syncMessage}</p>}

      <header className="page-hero">
        <h1>Votre suivi running</h1>
        <p>
          {strava?.connected
            ? `Bienvenue${strava.athlete_name ? `, ${strava.athlete_name}` : ''}. Vos sorties Strava sont isolées à votre compte.`
            : 'Reconnectez Strava via Logout puis Login si la sync échoue.'}
        </p>
        {strava?.connected && (
          <div className="admin-actions" style={{ marginTop: '1rem' }}>
            <button
              type="button"
              className="btn"
              onClick={() => void runSync()}
              disabled={syncBusy}
            >
              {syncBusy ? 'Sync…' : 'Synchroniser Strava'}
            </button>
          </div>
        )}
      </header>

      {analytics && (
        <section className="evolution" aria-labelledby="evolution-title">
          <div className="section-head">
            <h2 id="evolution-title">Évolution</h2>
          </div>

          <div className={`evolution-banner cat-${analytics.category}`}>
            <p className="evolution-label">{analytics.category_label_fr}</p>
            <ul className="reasons">
              {analytics.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>

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
                {analytics.window_28d.activities} sorties · allure{' '}
                {formatPaceSec(analytics.window_28d.avg_pace_sec_per_km)}
              </p>
            </div>
            <div className="metric-card">
              <h3>Volume</h3>
              <p className={`metric-value ${trendClass(analytics.trends.volume_pct)}`}>
                {formatTrend(analytics.trends.volume_pct)}
              </p>
              <p className="metric-sub">
                vs 28 j. préc. · vitesse{' '}
                <span className={trendClass(analytics.trends.speed_pct)}>
                  {formatTrend(analytics.trends.speed_pct)}
                </span>
              </p>
            </div>
            <div className="metric-card">
              <h3>Charge 28 j.</h3>
              <p className="metric-value">
                {analytics.window_28d.avg_heartrate != null
                  ? `${Math.round(analytics.window_28d.avg_heartrate)}`
                  : '—'}
                {analytics.window_28d.avg_heartrate != null && (
                  <span className="metric-unit"> bpm</span>
                )}
              </p>
              <p className="metric-sub">
                Cadence{' '}
                {analytics.window_28d.avg_cadence_ppm != null
                  ? `${Math.round(analytics.window_28d.avg_cadence_ppm)} PPM`
                  : '—'}
              </p>
            </div>
            <div className="metric-card">
              <h3>TRIMP / ACR</h3>
              {analytics.load?.available ? (
                <>
                  <p className="metric-value">
                    {analytics.load.acr != null ? analytics.load.acr : '—'}
                    {analytics.load.acr != null && <span className="metric-unit"> ACR</span>}
                  </p>
                  <p className="metric-sub">
                    7 j. {analytics.load.trimp_7d ?? '—'} · 28 j. {analytics.load.trimp_28d ?? '—'}
                    {analytics.load.acr_elevated ? ' · élevé' : ''}
                  </p>
                </>
              ) : (
                <>
                  <p className="metric-value">—</p>
                  <p className="metric-sub">
                    {analytics.load?.reason_fr ?? 'Charge physiologique indisponible'}
                  </p>
                </>
              )}
            </div>
            <div className="metric-card">
              <h3>Volume typé 28 j.</h3>
              <p className="metric-value">
                {(analytics.volume_quality_km_28d ?? 0).toFixed(1)}
                <span className="metric-unit"> km qualité</span>
              </p>
              <p className="metric-sub">
                Facile {(analytics.volume_easy_km_28d ?? 0).toFixed(1)} km
                {(analytics.volume_untagged_km_28d ?? 0) > 0
                  ? ` · non classé ${(analytics.volume_untagged_km_28d ?? 0).toFixed(1)} km`
                  : ''}
              </p>
            </div>
          </div>

          <div className="home-grid">
            <div className="panel-block">
              <h3>Forme (ATL / CTL / TSB)</h3>
              <FormChart
                series={loadSeries?.available ? loadSeries.series : []}
                form={loadSeries?.form ?? analytics.form}
                emptyReason={
                  loadSeries?.reason_fr ||
                  analytics.form?.reason_fr ||
                  'Pas assez de sorties avec TRIMP (FC + zones).'
                }
              />
            </div>
            {analytics.weekly_volume.length > 0 && (
              <div className="panel-block">
                <h3>Volume hebdomadaire</h3>
                <WeeklyVolumeChart weeks={analytics.weekly_volume} />
              </div>
            )}
            <div className="panel-block">
              <h3>Météo des sorties</h3>
              <dl className="weather-strip">
                <div className="weather-stat">
                  <dt>Sorties enrichies</dt>
                  <dd>{analytics.weather.activities_with_weather}</dd>
                </div>
                <div className="weather-stat">
                  <dt>Température moy.</dt>
                  <dd>
                    {analytics.weather.avg_temperature_c != null
                      ? `${analytics.weather.avg_temperature_c} °C`
                      : '—'}
                  </dd>
                </div>
                <div className="weather-stat">
                  <dt>Sous la pluie</dt>
                  <dd>
                    {analytics.weather.rainy_share_pct != null
                      ? `${analytics.weather.rainy_share_pct} %`
                      : '—'}
                    {analytics.weather.rainy_runs > 0
                      ? ` (${analytics.weather.rainy_runs})`
                      : ''}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </section>
      )}

      <section className="section">
        <div className="section-head">
          <h2>Dernières sorties</h2>
          <Link to="/activities" className="linkish">
            Tout voir
          </Link>
        </div>
        {activities.length === 0 ? (
          <div className="empty-state">
            <p className="muted" style={{ margin: 0 }}>
              Aucune sortie. Lancez une synchronisation Strava ci-dessus.
            </p>
          </div>
        ) : (
          <ul className="activity-list">
            {activities.slice(0, 5).map((activity) => (
              <li key={activity.id}>
                <ActivityRow
                  activity={activity}
                  onSessionTypeSaved={(activityId, sessionType, label) => {
                    setActivities((prev) =>
                      prev.map((a) =>
                        a.id === activityId
                          ? {
                              ...a,
                              session_type: sessionType,
                              session_type_label_fr: label,
                            }
                          : a,
                      ),
                    )
                  }}
                  onTerrainSaved={(activityId, terrain, label) => {
                    setActivities((prev) =>
                      prev.map((a) =>
                        a.id === activityId
                          ? {
                              ...a,
                              terrain,
                              terrain_label_fr: label,
                            }
                          : a,
                      ),
                    )
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

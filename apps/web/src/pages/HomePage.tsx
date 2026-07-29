import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ActivitySummary, AnalyticsOverview, HealthResponse, StravaStatus } from '../types'
import { formatPaceSec, formatTrend } from '../format'
import { ActivityRow } from '../components/ActivityRow'
import { WeeklyVolumeChart } from '../components/WeeklyVolumeChart'

function trendClass(value: number | null | undefined): string {
  if (value == null || value === 0) return ''
  return value > 0 ? 'trend-up' : 'trend-down'
}

export function HomePage() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [strava, setStrava] = useState<StravaStatus | null>(null)
  const [activities, setActivities] = useState<ActivitySummary[]>([])
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void Promise.all([
      fetch('/api/health'),
      fetch('/api/strava/status'),
      fetch('/api/activities?limit=100'),
      fetch('/api/analytics/overview'),
    ])
      .then(async ([healthRes, statusRes, listRes, analyticsRes]) => {
        if (!healthRes.ok) throw new Error(`Health HTTP ${healthRes.status}`)
        if (!statusRes.ok) throw new Error(`Status Strava HTTP ${statusRes.status}`)
        if (!listRes.ok) throw new Error(`Activités HTTP ${listRes.status}`)
        if (!analyticsRes.ok) throw new Error(`Analytics HTTP ${analyticsRes.status}`)
        const [h, s, a, an] = await Promise.all([
          healthRes.json() as Promise<HealthResponse>,
          statusRes.json() as Promise<StravaStatus>,
          listRes.json() as Promise<ActivitySummary[]>,
          analyticsRes.json() as Promise<AnalyticsOverview>,
        ])
        if (cancelled) return
        setHealth(h)
        setStrava(s)
        setActivities(a)
        setAnalytics(an)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Chargement impossible')
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <>
      {error && <p className="banner error">{error}</p>}

      <header className="page-hero">
        <h1>Votre suivi running</h1>
        <p>
          {strava?.connected
            ? `Bienvenue${strava.athlete_name ? `, ${strava.athlete_name}` : ''}. Vos sorties Strava sont synchronisées.`
            : 'Connectez Strava pour importer vos sorties et suivre votre évolution.'}
        </p>
        <div className="home-status">
          <span className="status-pill">
            <span className={`status-dot ${strava?.connected ? 'on' : ''}`} />
            {strava?.connected ? 'Strava connecté' : 'Strava déconnecté'}
          </span>
          {health && (
            <span className="status-pill">
              API {health.status} · {health.palier}
            </span>
          )}
          <Link to="/admin" className="inline-link">
            Ouvrir Admin
          </Link>
        </div>
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
          </div>

          <div className="home-grid">
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
              Aucune sortie. Allez dans Admin pour connecter Strava puis synchroniser.
            </p>
          </div>
        ) : (
          <ul className="activity-list">
            {activities.slice(0, 5).map((activity) => (
              <li key={activity.id}>
                <ActivityRow activity={activity} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

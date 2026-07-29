import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ActivitySummary, AnalyticsOverview, HealthResponse, StravaStatus } from '../types'
import { formatDate, formatKm, formatPace, formatPaceSec, formatTrend } from '../format'

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

      <section className="hero">
        <h1>Votre suivi running</h1>
        <p>
          {strava?.connected
            ? `Strava connecté${strava.athlete_name ? ` — ${strava.athlete_name}` : ''}.`
            : 'Connectez Strava depuis Admin pour importer vos sorties.'}{' '}
          {health ? `API ${health.status} (${health.palier}).` : ''}{' '}
          <Link to="/admin" className="inline-link">
            Ouvrir Admin
          </Link>
        </p>
      </section>

      {analytics && (
        <section className="panel evolution">
          <h2>Évolution</h2>
          <p className={`category cat-${analytics.category}`}>{analytics.category_label_fr}</p>
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
          <Link to="/activities" className="linkish">
            Tout voir
          </Link>
        </div>
        {activities.length === 0 ? (
          <p className="muted">Aucune sortie. Allez dans Admin pour connecter Strava puis synchroniser.</p>
        ) : (
          <ul className="activity-list">
            {activities.slice(0, 5).map((activity) => (
              <li key={activity.id}>
                <Link to={`/activities/${activity.id}`} className="activity">
                  <strong>{activity.name}</strong>
                  <span>
                    {formatDate(activity.start_date)} · {formatKm(activity.distance_m)} ·{' '}
                    {formatPace(activity.average_speed_mps)}
                    {activity.weather_json?.temperature_c != null
                      ? ` · ${Math.round(activity.weather_json.temperature_c)}°C`
                      : ''}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

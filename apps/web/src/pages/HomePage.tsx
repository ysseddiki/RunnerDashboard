import { useCallback, useEffect, useState } from 'react'
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
import { NextSessionsCard } from '../components/NextSessionsCard'
import { SessionTypeTrendsPanel } from '../components/SessionTypeTrendsPanel'
import { Panel } from '../components/Panel'
import { EmptyState, SkeletonHome, SkeletonList } from '../components/EmptyState'
import { FlashBanner } from '../components/FlashBanner'
import { apiFetch } from '../auth'
import type { SessionTypeTrendsResponse } from '../types'
import { friendlyError } from '../friendlyError'
import {
  HOME_CACHE_KEY,
  clearAllPageCaches,
  fetchDataRevision,
  peekPageCache,
  readPageCache,
  writePageCache,
} from '../pageCache'

function trendClass(value: number | null | undefined): string {
  if (value == null || value === 0) return ''
  return value > 0 ? 'trend-up' : 'trend-down'
}

type HomeCacheData = {
  strava: StravaStatus
  activities: ActivitySummary[]
  analytics: AnalyticsOverview
  loadSeries: LoadSeriesResponse | null
  typeTrends: SessionTypeTrendsResponse | null
}

export function HomePage() {
  const [strava, setStrava] = useState<StravaStatus | null>(null)
  const [activities, setActivities] = useState<ActivitySummary[]>([])
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null)
  const [loadSeries, setLoadSeries] = useState<LoadSeriesResponse | null>(null)
  const [typeTrends, setTypeTrends] = useState<SessionTypeTrendsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [syncBusy, setSyncBusy] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)

  const applyHomeData = useCallback((data: HomeCacheData) => {
    setStrava(data.strava)
    setActivities(data.activities)
    setAnalytics(data.analytics)
    setLoadSeries(data.loadSeries)
    setTypeTrends(data.typeTrends)
  }, [])

  async function fetchHomePayload(): Promise<HomeCacheData> {
    const [statusRes, listRes, analyticsRes, seriesRes, trendsRes] = await Promise.all([
      apiFetch('/api/strava/status'),
      apiFetch('/api/activities?limit=100'),
      apiFetch('/api/analytics/overview'),
      apiFetch('/api/analytics/load-series?days=84'),
      apiFetch('/api/analytics/session-type-trends?days=84'),
    ])
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
    let trends: SessionTypeTrendsResponse | null = null
    if (trendsRes.ok) {
      trends = (await trendsRes.json()) as SessionTypeTrendsResponse
    }
    return {
      strava: s,
      activities: a,
      analytics: an,
      loadSeries: series,
      typeTrends: trends,
    }
  }

  async function loadHome(options?: { bypassCache?: boolean; soft?: boolean }) {
    const revision = await fetchDataRevision()
    if (!options?.bypassCache) {
      const cached = readPageCache<HomeCacheData>(HOME_CACHE_KEY, revision)
      if (cached) {
        applyHomeData(cached)
        return
      }
    }
    const data = await fetchHomePayload()
    writePageCache(HOME_CACHE_KEY, revision, data)
    applyHomeData(data)
  }

  useEffect(() => {
    let cancelled = false
    const peeked = peekPageCache<HomeCacheData>(HOME_CACHE_KEY)
    if (peeked) {
      applyHomeData(peeked.data)
      setLoading(false)
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    void (async () => {
      try {
        await loadHome()
      } catch (err: unknown) {
        if (!cancelled) setError(friendlyError(err, 'Impossible de charger l’accueil.'))
      } finally {
        if (!cancelled) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [applyHomeData])

  const dismissError = useCallback(() => setError(null), [])
  const dismissSync = useCallback(() => setSyncMessage(null), [])

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
      setSyncMessage(
        typeof body.message === 'string' ? body.message : 'Synchronisation terminée.',
      )
      clearAllPageCaches()
      setRefreshing(true)
      await loadHome({ bypassCache: true })
    } catch (err) {
      setError(friendlyError(err, 'Synchronisation impossible.'))
    } finally {
      setRefreshing(false)
      setSyncBusy(false)
    }
  }

  return (
    <>
      <FlashBanner tone="error" message={error} onDismiss={dismissError} />
      <FlashBanner tone="ok" message={syncMessage} onDismiss={dismissSync} />

      <header className="page-hero page-hero-compact">
        <div className="page-hero-row">
          <h1>Accueil</h1>
          {refreshing ? (
            <span className="status-pill compact" aria-live="polite">
              Mise à jour…
            </span>
          ) : null}
        </div>
        {!loading && strava && !strava.connected ? (
          <div className="admin-actions" style={{ marginTop: '0.75rem' }}>
            <Link to="/login" className="btn primary">
              Reconnecter Strava
            </Link>
          </div>
        ) : null}
        {!loading && strava?.connected ? (
          <div className="admin-actions" style={{ marginTop: '0.75rem' }}>
            <button
              type="button"
              className="btn"
              onClick={() => void runSync()}
              disabled={syncBusy}
            >
              {syncBusy ? 'Synchronisation…' : 'Synchroniser'}
            </button>
          </div>
        ) : null}
      </header>

      {loading && !analytics ? <SkeletonHome /> : null}

      {analytics && (
        <section className="evolution" aria-labelledby="evolution-title">
          <div className="section-head">
            <h2 id="evolution-title">Évolution</h2>
          </div>

          <div className={`evolution-banner cat-${analytics.category}`}>
            <p className="evolution-label">{analytics.category_label_fr}</p>
            <ul className="reasons">
              {analytics.reasons.slice(0, 2).map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>

          <div className="metrics metrics-primary">
            <div className="metric-card metric-card-primary">
              <h3>28 jours</h3>
              <p className="metric-value">{analytics.window_28d.distance_km} km</p>
              <p className="metric-sub">
                {analytics.window_28d.activities} sorties ·{' '}
                {formatPaceSec(analytics.window_28d.avg_pace_sec_per_km)}
              </p>
            </div>
            <div className="metric-card metric-card-primary">
              <h3>Volume</h3>
              <p className={`metric-value ${trendClass(analytics.trends.volume_pct)}`}>
                {formatTrend(analytics.trends.volume_pct)}
              </p>
              <p className="metric-sub">
                Vitesse{' '}
                <span className={trendClass(analytics.trends.speed_pct)}>
                  {formatTrend(analytics.trends.speed_pct)}
                </span>
              </p>
            </div>
            <div className="metric-card metric-card-primary">
              <h3>Forme</h3>
              {analytics.load?.available ? (
                <>
                  <p className="metric-value">
                    {analytics.load.acr != null ? analytics.load.acr : '—'}
                    {analytics.load.acr != null && <span className="metric-unit"> ACR</span>}
                  </p>
                  <p className="metric-sub">
                    TRIMP 7 j. {analytics.load.trimp_7d ?? '—'}
                    {analytics.load.acr_elevated ? ' · élevé' : ''}
                  </p>
                </>
              ) : (
                <>
                  <p className="metric-value">—</p>
                  <p className="metric-sub">Charge indisponible</p>
                </>
              )}
            </div>
          </div>

          <div className="home-grid">
            <Panel id="home-next" title="Prochaines séances" defaultOpen>
              <NextSessionsCard data={analytics.next_sessions} />
            </Panel>
            <Panel id="home-form" title="Forme" defaultOpen>
              <FormChart
                series={loadSeries?.available ? loadSeries.series : []}
                form={loadSeries?.form ?? analytics.form}
                emptyReason={
                  loadSeries?.reason_fr ||
                  analytics.form?.reason_fr ||
                  'Pas assez de sorties avec FC.'
                }
              />
            </Panel>
            {analytics.weekly_volume.length > 0 && (
              <Panel id="home-volume" title="Volume hebdomadaire" defaultOpen={false}>
                <WeeklyVolumeChart weeks={analytics.weekly_volume} />
              </Panel>
            )}
            <Panel id="home-more" title="Autres indicateurs" defaultOpen={false}>
              <div className="metrics metrics-secondary">
                <div className="metric-card">
                  <h3>Total</h3>
                  <p className="metric-value">{analytics.totals.distance_km} km</p>
                  <p className="metric-sub">
                    {analytics.totals.activities} sorties · {analytics.totals.moving_time_h} h
                  </p>
                </div>
                <div className="metric-card">
                  <h3>FC moy. 28 j.</h3>
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
                      ? `${Math.round(analytics.window_28d.avg_cadence_ppm)}`
                      : '—'}
                  </p>
                </div>
                <div className="metric-card">
                  <h3>Qualité 28 j.</h3>
                  <p className="metric-value">
                    {(analytics.volume_quality_km_28d ?? 0).toFixed(1)}
                    <span className="metric-unit"> km</span>
                  </p>
                  <p className="metric-sub">
                    Facile {(analytics.volume_easy_km_28d ?? 0).toFixed(1)} km
                  </p>
                </div>
              </div>
              <dl className="weather-strip" style={{ marginTop: '1rem' }}>
                <div className="weather-stat">
                  <dt>Météo</dt>
                  <dd>
                    {analytics.weather.avg_temperature_c != null
                      ? `${analytics.weather.avg_temperature_c} °C`
                      : '—'}
                    {analytics.weather.rainy_share_pct != null
                      ? ` · pluie ${analytics.weather.rainy_share_pct} %`
                      : ''}
                  </dd>
                </div>
              </dl>
            </Panel>
            <Panel id="home-trends" title="Tendances par type" defaultOpen={false}>
              <SessionTypeTrendsPanel
                summary={analytics.session_type_trends_summary}
                trends={typeTrends?.trends}
                detailed={Boolean(typeTrends?.available)}
                emptyReason={typeTrends?.reason_fr}
              />
            </Panel>
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
        {loading && !analytics ? null : loading && activities.length === 0 ? (
          <div aria-busy="true" aria-label="Chargement des sorties">
            <SkeletonList rows={3} />
          </div>
        ) : activities.length === 0 ? (
          <EmptyState
            title="Aucune sortie"
            description="Synchronisez Strava pour importer vos activités."
            action={
              strava?.connected ? (
                <button type="button" className="btn" onClick={() => void runSync()} disabled={syncBusy}>
                  Synchroniser
                </button>
              ) : undefined
            }
          />
        ) : (
          <ul className="activity-list activity-list-home">
            {activities.slice(0, 5).map((activity) => (
              <li key={activity.id}>
                <ActivityRow activity={activity} readOnly compact />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

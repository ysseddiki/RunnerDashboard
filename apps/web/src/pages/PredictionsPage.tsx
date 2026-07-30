import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { AnalyticsOverview, PredictionsOverview } from '../types'
import { formatDate, formatFinishTime, formatPaceSec } from '../format'
import { sessionToneClass } from '../sessionTone'
import { PaceTrendChart } from '../components/PaceTrendChart'
import { ProjectionChart } from '../components/ProjectionChart'
import { apiFetch } from '../auth'

type ProjectionOverview = {
  available: boolean
  volume: Array<{ week: string; distance_km?: number; kind: string }>
  pace_10k: Array<{ week: string; pace_sec_per_km?: number; kind: string }>
  notes_fr: string[]
}

function formatSignedSec(sec: number | null | undefined): string {
  if (sec == null || Number.isNaN(sec)) return '—'
  const sign = sec > 0 ? '+' : ''
  return `${sign}${Math.round(sec)} s/km`
}

function formatHr(bpm: number | null | undefined): string {
  if (bpm == null) return '—'
  return `${Math.round(bpm)} bpm`
}

function InsightCards({ insights }: { insights: AnalyticsOverview }) {
  const d = insights.deltas
  const w = insights.window_28d
  const p = insights.previous_28d
  const gain = d?.pace_gain_sec_per_km

  return (
    <>
      <section className="section">
        <div className="section-head">
          <h2>Bilan des données</h2>
        </div>
        <p className="muted" style={{ marginTop: 0 }}>
          Vue globale déterministe sur tout l’historique analysé · fenêtre récente = 28 jours vs 28
          jours précédents.
        </p>
        <div className="metrics pred-metrics">
          <div className="metric-card">
            <h3>Volume total</h3>
            <p className="metric-value">{insights.totals.distance_km.toFixed(0)}</p>
            <p className="metric-sub">
              km · {insights.totals.activities} sorties · {insights.totals.moving_time_h.toFixed(0)}{' '}
              h
            </p>
          </div>
          <div className="metric-card">
            <h3>Secondes / km</h3>
            <p
              className="metric-value"
              style={{
                color:
                  gain == null ? undefined : gain > 0 ? 'var(--brand)' : gain < 0 ? '#8a3b2a' : undefined,
              }}
            >
              {formatSignedSec(gain)}
            </p>
            <p className="metric-sub">
              vs fenêtre préc. ·{' '}
              {w.avg_pace_sec_per_km != null ? formatPaceSec(w.avg_pace_sec_per_km) : '—'} maintenant
            </p>
          </div>
          <div className="metric-card">
            <h3>FC moyenne 28 j</h3>
            <p className="metric-value">{formatHr(w.avg_heartrate)}</p>
            <p className="metric-sub">
              préc. {formatHr(p.avg_heartrate)}
              {d?.heartrate_bpm != null
                ? ` · ${d.heartrate_bpm > 0 ? '+' : ''}${Math.round(d.heartrate_bpm)} bpm`
                : ''}
            </p>
          </div>
          <div className="metric-card">
            <h3>Tendance</h3>
            <p className="metric-value" style={{ fontSize: '1.45rem' }}>
              {insights.category_label_fr}
            </p>
            <p className="metric-sub">
              Vol. {d?.volume_pct != null ? `${d.volume_pct > 0 ? '+' : ''}${d.volume_pct}%` : '—'} ·
              Cadence {w.avg_cadence_ppm != null ? `${Math.round(w.avg_cadence_ppm)}` : '—'}
            </p>
          </div>
        </div>
      </section>

      <div className="home-grid">
        <section className="panel-block">
          <h3>Détail 28 jours</h3>
          <ul className="pred-training-list">
            <li>
              <div className="pred-training-main">
                <strong>Volume</strong>
              </div>
              <strong className="pred-training-pace">
                {w.distance_km.toFixed(1)} km ({w.activities} sorties)
              </strong>
            </li>
            <li>
              <div className="pred-training-main">
                <strong>Allure moy.</strong>
                <span className="muted">
                  préc. {p.avg_pace_sec_per_km != null ? formatPaceSec(p.avg_pace_sec_per_km) : '—'}
                </span>
              </div>
              <strong className="pred-training-pace">
                {w.avg_pace_sec_per_km != null ? formatPaceSec(w.avg_pace_sec_per_km) : '—'}
              </strong>
            </li>
            <li>
              <div className="pred-training-main">
                <strong>FC moy. / max moy.</strong>
              </div>
              <strong className="pred-training-pace">
                {formatHr(w.avg_heartrate)}
                {w.avg_max_heartrate != null ? ` / ${Math.round(w.avg_max_heartrate)}` : ''}
              </strong>
            </li>
            <li>
              <div className="pred-training-main">
                <strong>Dénivelé</strong>
              </div>
              <strong className="pred-training-pace">
                {w.elevation_gain_m != null ? `${Math.round(w.elevation_gain_m)} m` : '—'}
              </strong>
            </li>
            <li>
              <div className="pred-training-main">
                <strong>Cadence</strong>
              </div>
              <strong className="pred-training-pace">
                {w.avg_cadence_ppm != null ? `${Math.round(w.avg_cadence_ppm)} spm` : '—'}
              </strong>
            </li>
          </ul>
        </section>

        <section className="panel-block">
          <h3>Lecture utile</h3>
          {(insights.insight_notes_fr?.length ?? 0) === 0 && insights.reasons.length === 0 ? (
            <p className="muted">Pas encore assez de données pour commenter.</p>
          ) : (
            <ul className="docs-list">
              {(insights.insight_notes_fr ?? []).map((n) => (
                <li key={n}>{n}</li>
              ))}
              {insights.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
          {insights.weather.activities_with_weather > 0 && (
            <p className="muted" style={{ marginBottom: 0 }}>
              Météo : {insights.weather.avg_temperature_c ?? '—'} °C moy. ·{' '}
              {insights.weather.rainy_runs} sortie(s) sous pluie
              {insights.weather.rainy_share_pct != null
                ? ` (${insights.weather.rainy_share_pct} %)`
                : ''}
              .
            </p>
          )}
        </section>
      </div>

      <section className="section">
        <div className="section-head">
          <h2>FC × météo (même allure)</h2>
        </div>
        <p className="muted" style={{ marginTop: 0 }}>
          Corrélation déterministe : FC moyenne dans une bande d’allure comparable, selon la
          température. Pas d’IA sur les chiffres.
        </p>
        {!insights.hr_weather?.available ? (
          <p className="muted">
            {insights.hr_weather?.reason_fr ??
              'Pas encore assez de sorties avec FC + météo sur terrain route.'}
          </p>
        ) : (
          <>
            <div className="metrics pred-metrics">
              <div className="metric-card">
                <h3>Bande d’allure</h3>
                <p className="metric-value" style={{ fontSize: '1.35rem' }}>
                  {insights.hr_weather.pace_band_label_fr}
                </p>
                <p className="metric-sub">
                  n={insights.hr_weather.sample_size} · confiance{' '}
                  {insights.hr_weather.confidence_label_fr}
                </p>
              </div>
              <div className="metric-card">
                <h3>Δ FC chaud vs frais</h3>
                <p
                  className="metric-value"
                  style={{
                    color:
                      insights.hr_weather.hr_delta_warm_vs_cool_bpm == null
                        ? undefined
                        : insights.hr_weather.hr_delta_warm_vs_cool_bpm > 0
                          ? '#8a3b2a'
                          : 'var(--brand)',
                  }}
                >
                  {insights.hr_weather.hr_delta_warm_vs_cool_bpm == null
                    ? '—'
                    : `${insights.hr_weather.hr_delta_warm_vs_cool_bpm > 0 ? '+' : ''}${Math.round(
                        insights.hr_weather.hr_delta_warm_vs_cool_bpm,
                      )} bpm`}
                </p>
                <p className="metric-sub">≥20 °C vs &lt;12 °C</p>
              </div>
              <div className="metric-card">
                <h3>Pente FC / °C</h3>
                <p className="metric-value" style={{ fontSize: '1.45rem' }}>
                  {insights.hr_weather.slope_bpm_per_c == null
                    ? '—'
                    : `${insights.hr_weather.slope_bpm_per_c > 0 ? '+' : ''}${
                        insights.hr_weather.slope_bpm_per_c
                      }`}
                </p>
                <p className="metric-sub">bpm par degré (régression simple)</p>
              </div>
            </div>
            <div className="home-grid" style={{ marginTop: '0.85rem' }}>
              <section className="panel-block">
                <h3>Par tranche de température</h3>
                <ul className="pred-training-list">
                  {insights.hr_weather.buckets.map((b) => (
                    <li key={b.id}>
                      <div className="pred-training-main">
                        <strong>{b.label_fr}</strong>
                        <span className="muted">
                          {b.n} sortie{b.n > 1 ? 's' : ''}
                          {b.avg_temp_c != null ? ` · ${b.avg_temp_c} °C` : ''}
                        </span>
                      </div>
                      <strong className="pred-training-pace">{formatHr(b.avg_hr)}</strong>
                    </li>
                  ))}
                </ul>
              </section>
              <section className="panel-block">
                <h3>Lecture</h3>
                <ul className="docs-list">
                  {insights.hr_weather.notes_fr.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
                <p className="muted" style={{ marginBottom: 0 }}>
                  Filtres : {insights.hr_weather.filters_fr}. Eligible brutes :{' '}
                  {insights.hr_weather.eligible_with_hr_weather}.
                </p>
              </section>
            </div>
          </>
        )}
      </section>
    </>
  )
}

export function PredictionsPage() {
  const [data, setData] = useState<PredictionsOverview | null>(null)
  const [projection, setProjection] = useState<ProjectionOverview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void Promise.all([apiFetch('/api/predictions/overview'), apiFetch('/api/projections/overview')])
      .then(async ([predRes, projRes]) => {
        if (!predRes.ok) throw new Error(`Prévisions HTTP ${predRes.status}`)
        if (!projRes.ok) throw new Error(`Projection HTTP ${projRes.status}`)
        const [pred, proj] = await Promise.all([
          predRes.json() as Promise<PredictionsOverview>,
          projRes.json() as Promise<ProjectionOverview>,
        ])
        if (!cancelled) {
          setData(pred)
          setProjection(proj)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Chargement impossible')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const hero = data?.estimates.find((e) => e.id === data.hero_distance_id) ?? data?.estimates[1]
  const insights = data?.insights ?? null

  return (
    <>
      {error && <p className="banner error">{error}</p>}
      {loading && <p className="muted">Calcul des prévisions et du bilan…</p>}

      {!loading && data && (
        <>
          <header className="page-hero">
            <h1>Prévisions & bilan</h1>
            <p>
              Estimations d’allure (Riegel + ancres), bilan des données (s/km, FC, volume) et
              projection d’évolution — tout déterministe, sans IA.
            </p>
          </header>

          {data.warnings.map((w) => (
            <p key={w} className="banner warn">
              {w}
            </p>
          ))}

          {insights && <InsightCards insights={insights} />}

          {!data.available ? (
            <div className="empty-state">
              <p className="muted" style={{ margin: 0 }}>
                {data.reasons.join(' ') || 'Prévisions d’allure indisponibles.'}
              </p>
              <p style={{ margin: '0.75rem 0 0' }}>
                <Link to="/activities" className="inline-link">
                  Voir les activités
                </Link>
              </p>
            </div>
          ) : (
            <>
              <section className="section">
                <div className="section-head">
                  <h2>Prévisions d’allure</h2>
                </div>
              </section>

              <section className="evolution-banner cat-progression pred-hero-block">
                <span className="status-pill">Allure {hero?.label_fr ?? '10 km'} estimée</span>
                <p className="pred-hero-pace">{formatPaceSec(hero?.pace_sec_per_km)}</p>
                <p className="muted" style={{ margin: 0 }}>
                  Fourchette {formatPaceSec(hero?.pace_low_sec_per_km)} –{' '}
                  {formatPaceSec(hero?.pace_high_sec_per_km)} · Confiance{' '}
                  <strong>{data.confidence_label_fr}</strong>
                  {hero != null ? ` · Chrono ~ ${formatFinishTime(hero.finish_time_s)}` : ''}
                </p>
              </section>

              <section className="section">
                <div className="section-head">
                  <h2>Distances</h2>
                </div>
                <div className="metrics pred-metrics">
                  {data.estimates.map((est) => (
                    <div key={est.id} className="metric-card">
                      <h3>{est.label_fr}</h3>
                      <p className="metric-value">{formatPaceSec(est.pace_sec_per_km)}</p>
                      <p className="metric-sub">
                        {formatFinishTime(est.finish_time_s)} ·{' '}
                        {formatPaceSec(est.pace_low_sec_per_km)}–
                        {formatPaceSec(est.pace_high_sec_per_km)}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              <div className="home-grid">
                <section className="panel-block">
                  <h3>Allures d’entraînement</h3>
                  {data.training_paces.length === 0 ? (
                    <p className="muted">Pas encore d’allures d’entraînement calculables.</p>
                  ) : (
                    <ul className="pred-training-list">
                      {data.training_paces.map((tp) => (
                        <li key={tp.session_type}>
                          <div className="pred-training-main">
                            <span className={`chip ${sessionToneClass(tp.session_type)}`}>
                              {tp.label_fr}
                            </span>
                            <span className="muted">
                              {tp.source === 'observe'
                                ? `observé (${tp.sample_size} sortie${tp.sample_size > 1 ? 's' : ''})`
                                : 'dérivé du 10 km'}
                            </span>
                          </div>
                          <strong className="pred-training-pace">
                            {formatPaceSec(tp.pace_sec_per_km)}
                          </strong>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="panel-block">
                  <h3>Pourquoi ces chiffres</h3>
                  <ul className="reasons">
                    {data.reasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                  {data.anchor && (
                    <p className="muted">
                      Ancre :{' '}
                      <Link to={`/activities/${data.anchor.activity_id}`} className="inline-link">
                        {data.anchor.name}
                      </Link>{' '}
                      · {formatDate(data.anchor.start_date)} · {data.anchor.distance_km} km ·{' '}
                      {formatPaceSec(data.anchor.pace_sec_per_km)}
                      {data.anchor.session_type_label_fr
                        ? ` · ${data.anchor.session_type_label_fr}`
                        : ''}
                    </p>
                  )}
                  <p className="muted" style={{ marginBottom: 0 }}>
                    {data.activities_considered} sortie(s) prises en compte.
                  </p>
                </section>
              </div>

              <section className="section">
                <div className="section-head">
                  <h2>Tendance allure 10 km</h2>
                </div>
                <PaceTrendChart points={data.trend_10k} />
              </section>
            </>
          )}

          <section className="section">
            <div className="section-head">
              <h2>Projection d’évolution</h2>
            </div>
            {projection?.available ? (
              <>
                <ProjectionChart volume={projection.volume} pace10k={projection.pace_10k} />
                <ul className="docs-list">
                  {projection.notes_fr.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="muted">Pas encore de projection (historique insuffisant).</p>
            )}
          </section>
        </>
      )}
    </>
  )
}

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { PredictionsOverview } from '../types'
import { formatDate, formatFinishTime, formatPaceSec } from '../format'
import { sessionToneClass } from '../sessionTone'
import { PaceTrendChart } from '../components/PaceTrendChart'

export function PredictionsPage() {
  const [data, setData] = useState<PredictionsOverview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void fetch('/api/predictions/overview')
      .then(async (res) => {
        if (!res.ok) throw new Error(`Prévisions HTTP ${res.status}`)
        return (await res.json()) as PredictionsOverview
      })
      .then((payload) => {
        if (!cancelled) setData(payload)
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

  return (
    <>
      {error && <p className="banner error">{error}</p>}
      {loading && <p className="muted">Calcul des prévisions…</p>}

      {!loading && data && (
        <>
          <header className="page-hero">
            <h1>Prévisions d’allure</h1>
            <p>
              Estimations déterministes (formule type Riegel + ancres de séances), sans IA. Taggez
              compétitions, seuils et fractionnés pour améliorer la précision.
            </p>
          </header>

          {data.warnings.map((w) => (
            <p key={w} className="banner warn">
              {w}
            </p>
          ))}

          {!data.available ? (
            <div className="empty-state">
              <p className="muted" style={{ margin: 0 }}>
                {data.reasons.join(' ') || 'Prévisions indisponibles.'}
              </p>
              <p style={{ margin: '0.75rem 0 0' }}>
                <Link to="/activities" className="inline-link">
                  Voir les activités
                </Link>
              </p>
            </div>
          ) : (
            <>
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
        </>
      )}
    </>
  )
}

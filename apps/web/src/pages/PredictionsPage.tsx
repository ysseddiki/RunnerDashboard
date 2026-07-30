import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { PredictionsOverview } from '../types'
import { formatDate, formatFinishTime, formatPaceSec } from '../format'

function TrendSpark({ points }: { points: Array<{ week: string; pace_sec_per_km: number }> }) {
  const path = useMemo(() => {
    if (points.length < 2) return null
    const values = points.map((p) => p.pace_sec_per_km)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = max - min || 1
    const w = 520
    const h = 120
    // Invert Y: lower pace (faster) = higher on chart
    const coords = values.map((v, i) => {
      const x = (i / (values.length - 1)) * w
      const y = ((v - min) / range) * (h - 16) + 8
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    return { d: `M${coords.join(' L')}`, w, h, first: values[0]!, last: values[values.length - 1]! }
  }, [points])

  if (!path) {
    return <p className="muted">Pas assez d’historique pour tracer la tendance.</p>
  }

  const faster = path.last < path.first
  return (
    <div className="pred-trend">
      <svg viewBox={`0 0 ${path.w} ${path.h}`} role="img" aria-label="Tendance allure 10 km">
        <path d={path.d} fill="none" stroke="currentColor" strokeWidth="2.5" />
      </svg>
      <p className="muted">
        {points[0]?.week} → {points[points.length - 1]?.week} ·{' '}
        {formatPaceSec(path.first)} → {formatPaceSec(path.last)}
        {faster ? ' (plus rapide)' : path.last > path.first ? ' (plus lente)' : ''}
      </p>
    </div>
  )
}

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
              Estimations déterministes (formule type Riegel + ancres de séances), sans IA.
              Taggez compétitions, seuils et fractionnés pour améliorer la précision.
            </p>
          </header>

          {data.warnings.map((w) => (
            <p key={w} className="banner warn">
              {w}
            </p>
          ))}

          {!data.available ? (
            <section className="panel-block">
              <p className="muted">{data.reasons.join(' ') || 'Prévisions indisponibles.'}</p>
              <Link to="/activities" className="inline-link">
                Voir les activités
              </Link>
            </section>
          ) : (
            <>
              <section className="panel-block pred-hero-block">
                <p className="eyebrow-sm">Allure {hero?.label_fr ?? '10 km'} estimée</p>
                <p className="pred-hero-pace">{formatPaceSec(hero?.pace_sec_per_km)}</p>
                <p className="muted">
                  Fourchette {formatPaceSec(hero?.pace_low_sec_per_km)} –{' '}
                  {formatPaceSec(hero?.pace_high_sec_per_km)} · Confiance{' '}
                  <strong>{data.confidence_label_fr}</strong>
                  {hero != null ? ` · Chrono ~ ${formatFinishTime(hero.finish_time_s)}` : ''}
                </p>
              </section>

              <section className="panel-block">
                <h3>Distances</h3>
                <div className="metrics pred-metrics">
                  {data.estimates.map((est) => (
                    <div key={est.id} className="metric-card">
                      <h3>{est.label_fr}</h3>
                      <p className="metric-value">{formatPaceSec(est.pace_sec_per_km)}</p>
                      <p className="metric-sub">
                        {formatFinishTime(est.finish_time_s)} · {formatPaceSec(est.pace_low_sec_per_km)}–
                        {formatPaceSec(est.pace_high_sec_per_km)}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="panel-block">
                <h3>Allures d’entraînement</h3>
                {data.training_paces.length === 0 ? (
                  <p className="muted">Pas encore d’allures d’entraînement calculables.</p>
                ) : (
                  <ul className="pred-training-list">
                    {data.training_paces.map((tp) => (
                      <li key={tp.session_type}>
                        <div>
                          <strong>{tp.label_fr}</strong>
                          <span className="muted">
                            {tp.source === 'observe'
                              ? ` · observé (${tp.sample_size} sortie${tp.sample_size > 1 ? 's' : ''})`
                              : ' · dérivé du 10 km'}
                          </span>
                        </div>
                        <strong>{formatPaceSec(tp.pace_sec_per_km)}</strong>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="panel-block">
                <h3>Tendance allure 10 km (12 semaines)</h3>
                <TrendSpark points={data.trend_10k} />
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
                <p className="muted">
                  {data.activities_considered} sortie(s) prises en compte.
                </p>
              </section>
            </>
          )}
        </>
      )}
    </>
  )
}

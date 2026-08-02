import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { apiFetch } from '../auth'
import { formatDate } from '../format'
import { SkeletonDetail } from '../components/EmptyState'
import type { CompareActivitiesResponse, CompareDirection } from '../types'

function directionClass(dir: CompareDirection): string {
  if (dir === 'mieux') return 'compare-dir-mieux'
  if (dir === 'moins_bon') return 'compare-dir-moins'
  if (dir === 'stable') return 'compare-dir-stable'
  return 'compare-dir-indet'
}

function directionLabel(dir: CompareDirection): string {
  if (dir === 'mieux') return 'En progrès'
  if (dir === 'moins_bon') return 'En retrait'
  if (dir === 'stable') return 'Stable'
  return 'Indéterminé'
}

export function ComparePage() {
  const [params] = useSearchParams()
  const a = params.get('a')
  const b = params.get('b')
  const [data, setData] = useState<CompareActivitiesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const idA = a ? Number(a) : NaN
    const idB = b ? Number(b) : NaN
    if (!Number.isFinite(idA) || !Number.isFinite(idB) || idA === idB) {
      setLoading(false)
      setError('Sélectionnez exactement deux activités distinctes depuis Activités.')
      setData(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)
    void apiFetch('/api/activities/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activity_ids: [idA, idB] }),
    })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}))
        if (!res.ok) {
          const detail = body.detail
          const msg =
            typeof detail === 'string'
              ? detail
              : Array.isArray(detail)
                ? detail.map((d: { msg?: string }) => d.msg).filter(Boolean).join(' · ')
                : `Comparaison HTTP ${res.status}`
          throw new Error(msg || `Comparaison HTTP ${res.status}`)
        }
        return body as CompareActivitiesResponse
      })
      .then((payload) => {
        if (!cancelled) setData(payload)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setData(null)
          setError(err instanceof Error ? err.message : 'Comparaison impossible')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [a, b])

  return (
    <section className="compare-page">
      <Link to="/activities" className="linkish back">
        ← Retour aux activités
      </Link>

      <header className="page-hero">
        <h1>Comparer deux sorties</h1>
        <p>Lecture contextualisée des progrès entre deux séances, pas un simple tableau.</p>
      </header>

      {error && <p className="banner error">{error}</p>}
      {loading && <SkeletonDetail />}

      {!loading && data && (
        <>
          <section className="panel-block compare-intro" aria-labelledby="compare-intro-title">
            <p className="compare-interval" id="compare-intro-title">
              {data.days_between === 0
                ? 'Même jour'
                : data.days_between != null
                  ? `${data.interval_label_fr} entre les deux sorties`
                  : data.interval_label_fr}
            </p>
            <p className="compare-intro-text">{data.intro_fr}</p>
            <div className="compare-pair">
              <article className="compare-card">
                <p className="compare-card-label">Plus ancienne</p>
                <h2>
                  <Link to={`/activities/${data.activity_a.id}`}>{data.activity_a.name}</Link>
                </h2>
                <p className="muted">{formatDate(data.activity_a.start_date)}</p>
                {data.activity_a.session_type_label_fr && (
                  <p className="compare-type">{data.activity_a.session_type_label_fr}</p>
                )}
              </article>
              <article className="compare-card">
                <p className="compare-card-label">Plus récente</p>
                <h2>
                  <Link to={`/activities/${data.activity_b.id}`}>{data.activity_b.name}</Link>
                </h2>
                <p className="muted">{formatDate(data.activity_b.start_date)}</p>
                {data.activity_b.session_type_label_fr && (
                  <p className="compare-type">{data.activity_b.session_type_label_fr}</p>
                )}
              </article>
            </div>
          </section>

          <section className={`panel-block compare-verdict ${directionClass(data.overall_direction)}`}>
            <p className={`compare-badge ${directionClass(data.overall_direction)}`}>
              {directionLabel(data.overall_direction)}
            </p>
            <h2>{data.headline_fr}</h2>
            <p>{data.overall_summary_fr}</p>
          </section>

          <section className="panel-block">
            <h3>Métriques</h3>
            <ul className="compare-metrics">
              {data.metrics.map((m) => (
                <li key={m.key} className={directionClass(m.direction)}>
                  <div className="compare-metric-head">
                    <strong>{m.label_fr}</strong>
                    <span className={`compare-metric-dir ${directionClass(m.direction)}`}>
                      {directionLabel(m.direction)}
                    </span>
                  </div>
                  <div className="compare-metric-values">
                    <span>{m.display_a}</span>
                    <span aria-hidden="true">→</span>
                    <span>{m.display_b}</span>
                    {m.delta_display_fr && (
                      <span className="compare-metric-delta">{m.delta_display_fr}</span>
                    )}
                  </div>
                  {m.note_fr && <p className="muted compare-metric-note">{m.note_fr}</p>}
                </li>
              ))}
            </ul>
          </section>

          {data.caveats_fr.length > 0 && (
            <section className="panel-block compare-caveats">
              <h3>À garder en tête</h3>
              <ul>
                {data.caveats_fr.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </section>
  )
}

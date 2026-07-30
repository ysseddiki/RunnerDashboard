import type { ActivityFeatures } from '../types'
import { formatPaceSec } from '../format'

type Props = {
  features: ActivityFeatures | null | undefined
  sessionType: string | null | undefined
}

function na(reason?: string) {
  return reason ? `N/A — ${reason}` : 'N/A'
}

function reasonFor(features: ActivityFeatures, key: string): string | undefined {
  return features.unavailable?.find((u) => u.key === key)?.reason_fr
}

export function SessionInsights({ features, sessionType }: Props) {
  if (!features) {
    return (
      <section className="panel-block session-insights">
        <h3>Lecture séance</h3>
        <p className="muted">
          Pas encore de features calculées. Lancez un Sync ou « Recalculer les features » dans Admin.
        </p>
      </section>
    )
  }

  const session = features.session
  const family = session?.family ?? 'generic'
  const items: Array<{ label: string; value: string }> = []

  if (features.trimp_edwards != null) {
    items.push({ label: 'TRIMP', value: String(features.trimp_edwards) })
  } else {
    items.push({ label: 'TRIMP', value: na(reasonFor(features, 'trimp_edwards')) })
  }

  if (features.decoupling_pct != null) {
    items.push({
      label: 'Dérive cardiaque',
      value: `${features.decoupling_pct > 0 ? '+' : ''}${features.decoupling_pct} %`,
    })
  } else if (family === 'long_run' || sessionType === 'sortie_longue') {
    items.push({ label: 'Dérive cardiaque', value: na(reasonFor(features, 'decoupling')) })
  }

  if (features.time_in_zone) {
    const z = features.time_in_zone
    const z12 = ((z.Z1?.pct ?? 0) + (z.Z2?.pct ?? 0)).toFixed(0)
    items.push({ label: 'Temps Z1–Z2', value: `${z12} %` })
  } else if (family === 'easy') {
    items.push({ label: 'Temps Z1–Z2', value: na(reasonFor(features, 'time_in_zone')) })
  }

  if (session?.pct_above_z2 != null) {
    items.push({ label: 'Hors Z1–Z2', value: `${session.pct_above_z2} %` })
  }

  if (session?.split_delta_sec_per_km != null) {
    const d = session.split_delta_sec_per_km
    items.push({
      label: 'Split 2e vs 1re moitié',
      value: `${d > 0 ? '+' : ''}${d.toFixed(0)} s/km`,
    })
  }

  if (session?.regularity) {
    items.push({ label: 'Régularité allure', value: session.regularity })
  }

  if (features.intervals) {
    items.push({
      label: 'Intervalles détectés',
      value: `${features.intervals.count} (confiance ${features.intervals.confidence})`,
    })
  } else if (family === 'intervals') {
    items.push({ label: 'Intervalles', value: na(reasonFor(features, 'intervals')) })
  }

  if (session?.even_pacing_cv != null) {
    items.push({ label: 'Régularité course (CV)', value: session.even_pacing_cv.toFixed(3) })
  }

  const flags = features.quality_flags

  return (
    <section className="panel-block session-insights">
      <h3>Lecture séance</h3>
      {(sessionType || family !== 'generic') && (
        <p className="muted session-insights-meta">
          Template : {sessionType ?? 'non classé'} · famille {family}
          {flags?.has_streams === false ? ' · sans streams' : ''}
        </p>
      )}
      <dl className="insight-kpi-grid">
        {items.map((it) => (
          <div key={it.label} className="insight-kpi">
            <dt>{it.label}</dt>
            <dd>{it.value}</dd>
          </div>
        ))}
      </dl>
      {features.time_in_zone && (
        <div className="zone-bars" aria-label="Répartition zones FC">
          {(['Z1', 'Z2', 'Z3', 'Z4', 'Z5'] as const).map((zid) => {
            const pct = features.time_in_zone?.[zid]?.pct ?? 0
            return (
              <div key={zid} className="zone-bar-row">
                <span>{zid}</span>
                <div className="zone-bar-track">
                  <div className={`zone-bar-fill zone-${zid}`} style={{ width: `${pct}%` }} />
                </div>
                <span>{pct.toFixed(0)} %</span>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

type TablesProps = {
  features: ActivityFeatures | null | undefined
}

export function FeatureTables({ features }: TablesProps) {
  const splits = features?.splits_km
  const reps = features?.intervals?.reps

  if ((!splits || splits.length === 0) && (!reps || reps.length === 0)) {
    return null
  }

  return (
    <section className="panel-block feature-tables">
      {splits && splits.length > 0 && (
        <>
          <h3>Splits km</h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Km</th>
                  <th>Allure</th>
                  <th>FC</th>
                  <th>Cadence</th>
                </tr>
              </thead>
              <tbody>
                {splits.map((s) => (
                  <tr key={s.km}>
                    <td>{s.km}</td>
                    <td>{formatPaceSec(s.pace_sec_per_km)}</td>
                    <td>{s.avg_hr != null ? Math.round(s.avg_hr) : '—'}</td>
                    <td>{s.avg_cadence_ppm != null ? Math.round(s.avg_cadence_ppm) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {reps && reps.length > 0 && (
        <>
          <h3>Répétitions</h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Distance</th>
                  <th>Durée</th>
                  <th>Allure</th>
                  <th>FC</th>
                </tr>
              </thead>
              <tbody>
                {reps.map((r, i) => (
                  <tr key={`${r.start_distance_m}-${i}`}>
                    <td>{i + 1}</td>
                    <td>{(r.distance_m / 1000).toFixed(2)} km</td>
                    <td>{Math.round(r.duration_s)} s</td>
                    <td>{formatPaceSec(r.pace_sec_per_km)}</td>
                    <td>{r.avg_hr != null ? Math.round(r.avg_hr) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}

import type { SessionTypeTrend, SessionTypeTrendsSummary } from '../types'

type Props = {
  summary?: SessionTypeTrendsSummary | null
  trends?: SessionTypeTrend[] | null
  emptyReason?: string | null
  detailed?: boolean
}

const DIR_LABEL: Record<string, string> = {
  mieux: 'En progrès',
  stable: 'Stable',
  moins_bon: 'En retrait',
  indetermine: 'Indéterminé',
}

function dirClass(direction: string | null | undefined): string {
  if (direction === 'mieux') return 'trend-dir trend-dir-up'
  if (direction === 'moins_bon') return 'trend-dir trend-dir-down'
  if (direction === 'stable') return 'trend-dir trend-dir-flat'
  return 'trend-dir'
}

function formatDelta(pct: number | null | undefined): string {
  if (pct == null) return '—'
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)} % allure`
}

export function SessionTypeTrendsPanel({
  summary,
  trends,
  emptyReason,
  detailed = false,
}: Props) {
  const items =
    detailed && trends
      ? trends.filter((t) => t.available)
      : summary?.items || []

  if (!items.length) {
    return (
      <p className="muted">
        {emptyReason ||
          summary?.reason_fr ||
          'Pas assez de séances taguées par type pour calculer des tendances.'}
      </p>
    )
  }

  return (
    <ul className={`session-trends-list${detailed ? ' detailed' : ''}`}>
      {items.map((t) => {
        const direction = 'direction' in t ? t.direction : null
        const paceDelta =
          'pace_delta_pct' in t ? (t.pace_delta_pct as number | null) : null
        const label = t.label_fr || t.session_type
        return (
          <li key={t.session_type}>
            <div className="session-trend-row">
              <strong>{label}</strong>
              <span className={dirClass(direction)}>
                {DIR_LABEL[direction || ''] || '—'}
              </span>
            </div>
            <p className="muted session-trend-delta">
              {formatDelta(paceDelta)}
              {'sample_recent' in t && t.sample_recent != null
                ? ` · ${t.sample_recent} séance(s) récente(s)`
                : ''}
            </p>
          </li>
        )
      })}
    </ul>
  )
}

import { formatPaceSec } from '../format'
import { sessionToneClass } from '../sessionTone'
import type { NextSessionsResponse } from '../types'

type Props = {
  data: NextSessionsResponse | null | undefined
}

function formatDay(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    })
  } catch {
    return iso
  }
}

export function NextSessionsCard({ data }: Props) {
  if (!data) {
    return <p className="muted">Chargement des prochaines séances…</p>
  }
  if (!data.available) {
    return (
      <p className="muted">
        {data.reason_fr ||
          'Prescriptions indisponibles — synchronisez et taguez vos séances.'}
      </p>
    )
  }
  const sessions = data.sessions || []
  if (!sessions.length) {
    return <p className="muted">Aucune séance prescrite pour le moment.</p>
  }

  return (
    <div className="next-sessions">
      <p className="next-sessions-source">Source : règles déterministes (pas le LLM)</p>
      <ul className="next-sessions-list">
        {sessions.map((s) => (
          <li key={`${s.date}-${s.session_type}-${s.title_fr}`}>
            <div className="next-session-head">
              <time dateTime={s.date}>{formatDay(s.date)}</time>
              <span className={`chip ${sessionToneClass(s.session_type)}`}>
                {s.title_fr}
              </span>
            </div>
            <p className="next-session-meta">
              {s.duration_or_distance}
              {s.target_pace_sec_per_km != null
                ? ` · cible ${formatPaceSec(s.target_pace_sec_per_km)}`
                : ''}
            </p>
            <p className="next-session-why">{s.rationale_fr}</p>
          </li>
        ))}
      </ul>
      {data.notes_fr && data.notes_fr.length > 0 && (
        <ul className="next-sessions-notes">
          {data.notes_fr.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

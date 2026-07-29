import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ActivitySummary } from '../types'
import { formatDate, formatKm, formatPace } from '../format'

export function ActivitiesPage() {
  const [activities, setActivities] = useState<ActivitySummary[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetch('/api/activities?limit=100')
      .then(async (res) => {
        if (!res.ok) throw new Error(`Activités HTTP ${res.status}`)
        return (await res.json()) as ActivitySummary[]
      })
      .then((data) => {
        if (!cancelled) setActivities(data)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Chargement impossible')
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="panel" style={{ borderTop: 0, paddingTop: 0, marginTop: 0 }}>
      <h2>Toutes les activités</h2>
      <p className="muted">Cliquez une sortie pour ouvrir le détail complet.</p>
      {error && <p className="banner error">{error}</p>}
      {activities.length === 0 && !error ? (
        <p className="muted">Aucune sortie synchronisée.</p>
      ) : (
        <ul className="activity-list">
          {activities.map((activity) => (
            <li key={activity.id}>
              <Link to={`/activities/${activity.id}`} className="activity">
                <strong>{activity.name}</strong>
                <span>
                  {activity.session_type_label_fr
                    ? `${activity.session_type_label_fr} · `
                    : ''}
                  {formatDate(activity.start_date)} · {formatKm(activity.distance_m)} ·{' '}
                  {formatPace(activity.average_speed_mps)}
                  {activity.average_heartrate != null
                    ? ` · ${Math.round(activity.average_heartrate)} bpm`
                    : ''}
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
  )
}

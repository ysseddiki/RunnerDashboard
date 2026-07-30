import { useEffect, useMemo, useState } from 'react'
import type { ActivitySummary } from '../types'
import { ActivityRow } from '../components/ActivityRow'

export function ActivitiesPage() {
  const [activities, setActivities] = useState<ActivitySummary[]>([])
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [sessionFilter, setSessionFilter] = useState('all')

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

  const sessionOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const a of activities) {
      if (a.session_type && a.session_type_label_fr) {
        map.set(a.session_type, a.session_type_label_fr)
      }
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], 'fr'))
  }, [activities])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return activities.filter((a) => {
      if (sessionFilter === 'untyped' && a.session_type) return false
      if (sessionFilter !== 'all' && sessionFilter !== 'untyped' && a.session_type !== sessionFilter) {
        return false
      }
      if (!q) return true
      const hay = [
        a.name,
        a.session_type_label_fr,
        a.sport_type,
        a.weather_json?.weather_label_fr,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [activities, query, sessionFilter])

  return (
    <>
      <header className="page-hero">
        <h1>Activités</h1>
        <p>Toutes vos sorties synchronisées — filtrez par type de séance ou recherchez un nom.</p>
      </header>

      {error && <p className="banner error">{error}</p>}

      <div className="toolbar">
        <input
          type="search"
          className="search-input"
          placeholder="Rechercher une sortie…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Rechercher une activité"
        />
        <select
          className="filter-select"
          value={sessionFilter}
          onChange={(e) => setSessionFilter(e.target.value)}
          aria-label="Filtrer par type de séance"
        >
          <option value="all">Tous les types</option>
          <option value="untyped">Non classés</option>
          {sessionOptions.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {activities.length === 0 && !error ? (
        <div className="empty-state">
          <p className="muted" style={{ margin: 0 }}>
            Aucune sortie synchronisée.
          </p>
        </div>
      ) : (
        <>
          <p className="list-meta">
            {filtered.length} sortie{filtered.length > 1 ? 's' : ''}
            {filtered.length !== activities.length ? ` sur ${activities.length}` : ''}
          </p>
          {filtered.length === 0 ? (
            <div className="empty-state">
              <p className="muted" style={{ margin: 0 }}>
                Aucun résultat pour ces filtres.
              </p>
            </div>
          ) : (
            <ul className="activity-list">
              {filtered.map((activity) => (
                <li key={activity.id}>
                  <ActivityRow
                    activity={activity}
                    onSessionTypeSaved={(activityId, sessionType, label) => {
                      setActivities((prev) =>
                        prev.map((a) =>
                          a.id === activityId
                            ? {
                                ...a,
                                session_type: sessionType,
                                session_type_label_fr: label,
                              }
                            : a,
                        ),
                      )
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  )
}

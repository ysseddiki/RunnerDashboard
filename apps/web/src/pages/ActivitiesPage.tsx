import { useEffect, useMemo, useState } from 'react'
import type { ActivitySummary } from '../types'
import { ActivityRow } from '../components/ActivityRow'
import { useTerrains } from '../useTerrains'
import { apiFetch } from '../auth'

type PeriodFilter = 'all' | '28d' | '90d' | '365d'

function withinPeriod(iso: string | null, period: PeriodFilter): boolean {
  if (period === 'all' || !iso) return period === 'all' ? true : false
  const start = new Date(iso).getTime()
  if (Number.isNaN(start)) return false
  const days = period === '28d' ? 28 : period === '90d' ? 90 : 365
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  return start >= cutoff
}

export function ActivitiesPage() {
  const { terrains } = useTerrains()
  const [activities, setActivities] = useState<ActivitySummary[]>([])
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [sessionFilter, setSessionFilter] = useState('all')
  const [terrainFilter, setTerrainFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all')
  const [weatherFilter, setWeatherFilter] = useState('all')

  useEffect(() => {
    let cancelled = false
    void apiFetch('/api/activities?limit=200')
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

  const terrainOptions = useMemo(() => {
    const present = new Set(activities.map((a) => a.terrain).filter(Boolean) as string[])
    return terrains.filter((t) => present.has(t.id))
  }, [activities, terrains])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return activities.filter((a) => {
      if (sessionFilter === 'untyped' && a.session_type) return false
      if (sessionFilter !== 'all' && sessionFilter !== 'untyped' && a.session_type !== sessionFilter) {
        return false
      }
      if (terrainFilter === 'untyped' && a.terrain) return false
      if (terrainFilter !== 'all' && terrainFilter !== 'untyped' && a.terrain !== terrainFilter) {
        return false
      }
      if (sourceFilter === 'strava' && (a.source === 'apple' || a.apple_uuid)) return false
      if (sourceFilter === 'apple' && a.source !== 'apple') return false
      if (sourceFilter === 'linked' && !a.apple_uuid) return false
      if (!withinPeriod(a.start_date, periodFilter)) return false
      if (weatherFilter === 'with' && a.weather_json?.temperature_c == null) return false
      if (weatherFilter === 'without' && a.weather_json?.temperature_c != null) return false
      if (weatherFilter === 'hot' && !(a.weather_json?.temperature_c != null && a.weather_json.temperature_c >= 20)) {
        return false
      }
      if (weatherFilter === 'cold' && !(a.weather_json?.temperature_c != null && a.weather_json.temperature_c < 12)) {
        return false
      }
      if (weatherFilter === 'rain') {
        const code = a.weather_json?.weather_code
        const rainy =
          code != null &&
          ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95)
        if (!rainy) return false
      }
      if (!q) return true
      const hay = [
        a.name,
        a.session_type_label_fr,
        a.terrain_label_fr,
        a.sport_type,
        a.weather_json?.weather_label_fr,
        a.source_label_fr,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [
    activities,
    query,
    sessionFilter,
    terrainFilter,
    sourceFilter,
    periodFilter,
    weatherFilter,
  ])

  const hasActiveFilters =
    query.trim() !== '' ||
    sessionFilter !== 'all' ||
    terrainFilter !== 'all' ||
    sourceFilter !== 'all' ||
    periodFilter !== 'all' ||
    weatherFilter !== 'all'

  function resetFilters() {
    setQuery('')
    setSessionFilter('all')
    setTerrainFilter('all')
    setSourceFilter('all')
    setPeriodFilter('all')
    setWeatherFilter('all')
  }

  return (
    <>
      <header className="page-hero">
        <h1>Activités</h1>
        <p>
          Toutes vos sorties synchronisées — filtrez par type, terrain, période, source ou météo.
        </p>
      </header>

      {error && <p className="banner error">{error}</p>}

      <div className="toolbar toolbar-filters">
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
        <select
          className="filter-select"
          value={terrainFilter}
          onChange={(e) => setTerrainFilter(e.target.value)}
          aria-label="Filtrer par terrain"
        >
          <option value="all">Tous les terrains</option>
          <option value="untyped">Terrain non renseigné</option>
          {terrainOptions.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label_fr}
            </option>
          ))}
        </select>
        <select
          className="filter-select"
          value={periodFilter}
          onChange={(e) => setPeriodFilter(e.target.value as PeriodFilter)}
          aria-label="Filtrer par période"
        >
          <option value="all">Toutes périodes</option>
          <option value="28d">28 derniers jours</option>
          <option value="90d">90 derniers jours</option>
          <option value="365d">12 derniers mois</option>
        </select>
        <select
          className="filter-select"
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          aria-label="Filtrer par source"
        >
          <option value="all">Toutes sources</option>
          <option value="strava">Strava seul</option>
          <option value="linked">Strava + Apple</option>
          <option value="apple">Apple seul</option>
        </select>
        <select
          className="filter-select"
          value={weatherFilter}
          onChange={(e) => setWeatherFilter(e.target.value)}
          aria-label="Filtrer par météo"
        >
          <option value="all">Toute météo</option>
          <option value="with">Avec météo</option>
          <option value="without">Sans météo</option>
          <option value="hot">Chaud (≥ 20 °C)</option>
          <option value="cold">Frais (&lt; 12 °C)</option>
          <option value="rain">Pluie / orage</option>
        </select>
        {hasActiveFilters && (
          <button type="button" className="btn btn-ghost filter-reset" onClick={resetFilters}>
            Réinitialiser
          </button>
        )}
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
                    onTerrainSaved={(activityId, terrain, label) => {
                      setActivities((prev) =>
                        prev.map((a) =>
                          a.id === activityId
                            ? {
                                ...a,
                                terrain,
                                terrain_label_fr: label,
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

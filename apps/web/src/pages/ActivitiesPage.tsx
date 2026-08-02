import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import type { ActivitySummary } from '../types'
import { ActivityRow } from '../components/ActivityRow'
import { EmptyState, SkeletonList } from '../components/EmptyState'
import { useSessionTypes } from '../useSessionTypes'
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
  const { types: sessionTypes } = useSessionTypes()
  const [activities, setActivities] = useState<ActivitySummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [sessionFilter, setSessionFilter] = useState('all')
  const [terrainFilter, setTerrainFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all')
  const [weatherFilter, setWeatherFilter] = useState('all')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [busy, setBusy] = useState(false)
  const [bulkSession, setBulkSession] = useState('')
  const [bulkTerrain, setBulkTerrain] = useState('')
  const [minConfidence, setMinConfidence] = useState<'basse' | 'moyenne' | 'haute'>('basse')

  const reload = useCallback(async () => {
    const res = await apiFetch('/api/activities?limit=200')
    if (!res.ok) throw new Error(`Activités HTTP ${res.status}`)
    setActivities((await res.json()) as ActivitySummary[])
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void reload()
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Chargement impossible')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [reload])

  const sessionOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const t of sessionTypes) {
      map.set(t.id, t.label_fr)
    }
    for (const a of activities) {
      if (a.session_type && a.session_type_label_fr) {
        map.set(a.session_type, a.session_type_label_fr)
      }
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], 'fr'))
  }, [activities, sessionTypes])

  const terrainOptions = useMemo(() => terrains, [terrains])

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

  const filteredIds = useMemo(() => filtered.map((a) => a.id), [filtered])
  const selectedCount = selected.size
  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selected.has(id))

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

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAllFiltered() {
    setSelected((prev) => {
      if (allFilteredSelected) {
        const next = new Set(prev)
        for (const id of filteredIds) next.delete(id)
        return next
      }
      const next = new Set(prev)
      for (const id of filteredIds) next.add(id)
      return next
    })
  }

  async function runBulk(payload: Record<string, unknown>) {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const res = await apiFetch('/api/activities/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(
          typeof body.detail === 'string' ? body.detail : `Bulk HTTP ${res.status}`,
        )
      }
      setMessage(typeof body.message === 'string' ? body.message : 'Mise à jour OK.')
      setSelected(new Set())
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mise à jour impossible')
    } finally {
      setBusy(false)
    }
  }

  async function clearAllTypes() {
    if (
      !window.confirm(
        'Effacer tous vos types de séance ? Les activités repasseront en « Non classé ».',
      )
    ) {
      return
    }
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const res = await apiFetch('/api/activities/clear-session-types', { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(
          typeof body.detail === 'string' ? body.detail : `Reset HTTP ${res.status}`,
        )
      }
      setMessage(typeof body.message === 'string' ? body.message : 'Types effacés.')
      setSelected(new Set())
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Effacement impossible')
    } finally {
      setBusy(false)
    }
  }

  async function autoClassify(scope: 'untagged' | 'selected') {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const payload: Record<string, unknown> = {
        use_ai: false,
        untagged_only: scope === 'untagged',
        limit: 100,
        min_confidence: minConfidence,
      }
      if (scope === 'selected') {
        if (selected.size === 0) {
          throw new Error('Sélectionnez au moins une activité.')
        }
        payload.activity_ids = [...selected]
        payload.untagged_only = false
      }
      const res = await apiFetch('/api/activities/apply-session-type-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(
          typeof body.detail === 'string' ? body.detail : `Auto HTTP ${res.status}`,
        )
      }
      setMessage(typeof body.message === 'string' ? body.message : 'Classification terminée.')
      setSelected(new Set())
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Classification automatique impossible')
    } finally {
      setBusy(false)
    }
  }

  const untypedCount = activities.filter((a) => !a.session_type).length

  return (
    <>
      <header className="page-hero">
        <h1>Activités</h1>
        <p>
          Filtrez, sélectionnez, classez en masse (type + terrain) ou laissez l’auto-suggestion
          (allure, FC/zones, features, profil).
        </p>
      </header>

      {error && <p className="banner error">{error}</p>}
      {message && <p className="banner ok">{message}</p>}

      <section className="classify-bar" aria-label="Classification">
        <div className="classify-bar-main">
          <button
            type="button"
            className="btn btn-ghost"
            disabled={busy || activities.length === 0}
            onClick={() => void clearAllTypes()}
          >
            Effacer tous les types
          </button>
          <label className="classify-inline">
            Confiance min.
            <select
              className="filter-select"
              value={minConfidence}
              onChange={(e) =>
                setMinConfidence(e.target.value as 'basse' | 'moyenne' | 'haute')
              }
              disabled={busy}
            >
              <option value="basse">Basse</option>
              <option value="moyenne">Moyenne</option>
              <option value="haute">Haute</option>
            </select>
          </label>
          <button
            type="button"
            className="btn"
            disabled={busy || untypedCount === 0}
            onClick={() => void autoClassify('untagged')}
          >
            Auto-classer non classés ({untypedCount})
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={busy || selectedCount === 0}
            onClick={() => void autoClassify('selected')}
          >
            Auto-classer la sélection
          </button>
        </div>
        {selectedCount > 0 && (
          <div className="classify-bar-bulk">
            <span className="muted">{selectedCount} sélectionnée(s)</span>
            {selectedCount === 2 && (
              <Link
                className="btn"
                to={`/compare?a=${[...selected][0]}&b=${[...selected][1]}`}
              >
                Comparer
              </Link>
            )}
            <select
              className="filter-select"
              value={bulkSession}
              onChange={(e) => setBulkSession(e.target.value)}
              aria-label="Type pour la sélection"
              disabled={busy}
            >
              <option value="">Type de séance…</option>
              <option value="__clear__">Effacer le type</option>
              {sessionOptions.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-small"
              disabled={busy || !bulkSession}
              onClick={() =>
                void runBulk({
                  activity_ids: [...selected],
                  ...(bulkSession === '__clear__'
                    ? { clear_session_type: true }
                    : { session_type: bulkSession }),
                })
              }
            >
              Appliquer type
            </button>
            <select
              className="filter-select"
              value={bulkTerrain}
              onChange={(e) => setBulkTerrain(e.target.value)}
              aria-label="Terrain pour la sélection"
              disabled={busy}
            >
              <option value="">Terrain…</option>
              <option value="__clear__">Effacer le terrain</option>
              {terrainOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label_fr}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-small"
              disabled={busy || !bulkTerrain}
              onClick={() =>
                void runBulk({
                  activity_ids: [...selected],
                  ...(bulkTerrain === '__clear__'
                    ? { clear_terrain: true }
                    : { terrain: bulkTerrain }),
                })
              }
            >
              Appliquer terrain
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-small"
              disabled={busy}
              onClick={() => setSelected(new Set())}
            >
              Vider sélection
            </button>
          </div>
        )}
      </section>

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

      {loading ? (
        <div aria-busy="true" aria-label="Chargement des activités">
          <SkeletonList rows={6} />
        </div>
      ) : activities.length === 0 && !error ? (
        <EmptyState
          title="Aucune sortie synchronisée"
          description="Connectez Strava et lancez une synchronisation depuis l’accueil ou l’admin pour voir vos activités ici."
        />
      ) : (
        <>
          <div className="list-meta-row">
            <p className="list-meta">
              {filtered.length} sortie{filtered.length > 1 ? 's' : ''}
              {filtered.length !== activities.length ? ` sur ${activities.length}` : ''}
            </p>
            {filtered.length > 0 && (
              <label className="select-all">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleSelectAllFiltered}
                />
                Tout sélectionner (filtre)
              </label>
            )}
          </div>
          {filtered.length === 0 ? (
            <EmptyState
              title="Aucun résultat"
              description="Aucun résultat pour ces filtres. Essayez d’élargir la période ou de réinitialiser."
              action={
                hasActiveFilters ? (
                  <button type="button" className="btn btn-ghost" onClick={resetFilters}>
                    Réinitialiser les filtres
                  </button>
                ) : undefined
              }
            />
          ) : (
            <ul className="activity-list">
              {filtered.map((activity, index) => (
                <li key={activity.id} style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}>
                  <ActivityRow
                    activity={activity}
                    selected={selected.has(activity.id)}
                    onToggleSelect={toggleSelect}
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

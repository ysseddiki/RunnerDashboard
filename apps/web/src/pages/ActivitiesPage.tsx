import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import type { ActivitySummary } from '../types'
import { ActivityRow } from '../components/ActivityRow'
import { EmptyState, SkeletonList } from '../components/EmptyState'
import { FlashBanner } from '../components/FlashBanner'
import { useSessionTypes } from '../useSessionTypes'
import { useTerrains } from '../useTerrains'
import { apiFetch } from '../auth'
import { friendlyError } from '../friendlyError'
import {
  ACTIVITIES_CACHE_KEY,
  HOME_CACHE_KEY,
  clearPageCache,
  fetchDataRevision,
  peekPageCache,
  readPageCache,
  writePageCache,
} from '../pageCache'

type PeriodFilter = 'all' | '28d' | '90d' | '365d'

type ActivitiesCacheData = {
  activities: ActivitySummary[]
}

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
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [sessionFilter, setSessionFilter] = useState('all')
  const [terrainFilter, setTerrainFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all')
  const [weatherFilter, setWeatherFilter] = useState('all')
  const [moreFilters, setMoreFilters] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [bulkSession, setBulkSession] = useState('')
  const [bulkTerrain, setBulkTerrain] = useState('')
  const [minConfidence, setMinConfidence] = useState<'basse' | 'moyenne' | 'haute'>('basse')

  const busy = busyAction != null

  const reload = useCallback(async (options?: { bypassCache?: boolean }) => {
    const revision = await fetchDataRevision()
    if (!options?.bypassCache) {
      const cached = readPageCache<ActivitiesCacheData>(ACTIVITIES_CACHE_KEY, revision)
      if (cached?.activities) {
        setActivities(cached.activities)
        return
      }
    }
    const res = await apiFetch('/api/activities?limit=200')
    if (!res.ok) throw new Error(`Activités HTTP ${res.status}`)
    const list = (await res.json()) as ActivitySummary[]
    setActivities(list)
    writePageCache(ACTIVITIES_CACHE_KEY, revision, { activities: list })
    if (options?.bypassCache) {
      clearPageCache(HOME_CACHE_KEY)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const peeked = peekPageCache<ActivitiesCacheData>(ACTIVITIES_CACHE_KEY)
    if (peeked?.data.activities) {
      setActivities(peeked.data.activities)
      setLoading(false)
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    void reload()
      .catch((err: unknown) => {
        if (!cancelled) setError(friendlyError(err, 'Impossible de charger les activités.'))
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
          setRefreshing(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [reload])

  const dismissError = useCallback(() => setError(null), [])
  const dismissMessage = useCallback(() => setMessage(null), [])

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
  const selectedIds = useMemo(() => [...selected], [selected])

  const hasActiveFilters =
    query.trim() !== '' ||
    sessionFilter !== 'all' ||
    terrainFilter !== 'all' ||
    sourceFilter !== 'all' ||
    periodFilter !== 'all' ||
    weatherFilter !== 'all'

  const extraFiltersActive =
    terrainFilter !== 'all' || sourceFilter !== 'all' || weatherFilter !== 'all'

  function resetFilters() {
    setQuery('')
    setSessionFilter('all')
    setTerrainFilter('all')
    setSourceFilter('all')
    setPeriodFilter('all')
    setWeatherFilter('all')
  }

  function toggleSelect(activityId: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(activityId)) next.delete(activityId)
      else next.add(activityId)
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

  async function runBulk(payload: Record<string, unknown>, actionId: string) {
    setBusyAction(actionId)
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
      setMessage(typeof body.message === 'string' ? body.message : 'Mise à jour effectuée.')
      setSelected(new Set())
      await reload({ bypassCache: true })
    } catch (err) {
      setError(friendlyError(err, 'Mise à jour impossible.'))
    } finally {
      setBusyAction(null)
    }
  }

  async function clearAllTypes() {
    if (!window.confirm('Effacer tous les types de séance ?')) return
    setBusyAction('clear')
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
      await reload({ bypassCache: true })
    } catch (err) {
      setError(friendlyError(err, 'Effacement impossible.'))
    } finally {
      setBusyAction(null)
    }
  }

  async function autoClassify(scope: 'untagged' | 'selected') {
    setBusyAction(scope === 'untagged' ? 'auto-untagged' : 'auto-selected')
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
      await reload({ bypassCache: true })
    } catch (err) {
      setError(friendlyError(err, 'Classification impossible.'))
    } finally {
      setBusyAction(null)
    }
  }

  const untypedCount = activities.filter((a) => !a.session_type).length

  function patchActivityLocal(activityId: number, patch: Partial<ActivitySummary>) {
    setActivities((prev) => {
      const next = prev.map((a) => (a.id === activityId ? { ...a, ...patch } : a))
      void fetchDataRevision()
        .then((revision) => {
          writePageCache(ACTIVITIES_CACHE_KEY, revision, { activities: next })
          clearPageCache(HOME_CACHE_KEY)
        })
        .catch(() => {
          clearPageCache(ACTIVITIES_CACHE_KEY)
          clearPageCache(HOME_CACHE_KEY)
        })
      return next
    })
  }

  return (
    <>
      <header className="page-hero page-hero-compact">
        <div className="page-hero-row">
          <h1>Activités</h1>
          {refreshing ? (
            <span className="status-pill compact" aria-live="polite">
              Mise à jour…
            </span>
          ) : null}
        </div>
      </header>

      <FlashBanner tone="error" message={error} onDismiss={dismissError} />
      <FlashBanner tone="ok" message={message} onDismiss={dismissMessage} />

      <div className="toolbar toolbar-filters toolbar-sticky">
        <input
          type="search"
          className="search-input"
          placeholder="Rechercher…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Rechercher une activité"
        />
        <select
          className="filter-select"
          value={sessionFilter}
          onChange={(e) => setSessionFilter(e.target.value)}
          aria-label="Type de séance"
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
          value={periodFilter}
          onChange={(e) => setPeriodFilter(e.target.value as PeriodFilter)}
          aria-label="Période"
        >
          <option value="all">Toutes périodes</option>
          <option value="28d">28 jours</option>
          <option value="90d">90 jours</option>
          <option value="365d">12 mois</option>
        </select>
        <button
          type="button"
          className={`btn btn-ghost${extraFiltersActive ? ' is-active-filter' : ''}`}
          onClick={() => setMoreFilters((v) => !v)}
          aria-expanded={moreFilters}
        >
          Plus de filtres
        </button>
        {hasActiveFilters && (
          <button type="button" className="btn btn-ghost filter-reset" onClick={resetFilters}>
            Réinitialiser
          </button>
        )}
      </div>

      {moreFilters ? (
        <div className="toolbar toolbar-filters toolbar-more">
          <select
            className="filter-select"
            value={terrainFilter}
            onChange={(e) => setTerrainFilter(e.target.value)}
            aria-label="Terrain"
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
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            aria-label="Source"
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
            aria-label="Météo"
          >
            <option value="all">Toute météo</option>
            <option value="with">Avec météo</option>
            <option value="without">Sans météo</option>
            <option value="hot">Chaud (≥ 20 °C)</option>
            <option value="cold">Frais (&lt; 12 °C)</option>
            <option value="rain">Pluie</option>
          </select>
        </div>
      ) : null}

      <details className="classify-details">
        <summary>Classification automatique</summary>
        <div className="classify-bar-main">
          <label className="classify-inline">
            Confiance
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
            {busyAction === 'auto-untagged' ? '…' : `Auto-classer (${untypedCount})`}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={busy || activities.length === 0}
            onClick={() => void clearAllTypes()}
          >
            {busyAction === 'clear' ? '…' : 'Effacer tous les types'}
          </button>
        </div>
      </details>

      {selectedCount > 0 ? (
        <section className="bulk-bar" aria-label="Actions sur la sélection">
          <div className="bulk-bar-lead">
            <span className="muted">{selectedCount} sélectionnée(s)</span>
            {selectedCount === 2 ? (
              <Link className="btn primary" to={`/compare?a=${selectedIds[0]}&b=${selectedIds[1]}`}>
                Comparer
              </Link>
            ) : (
              <span className="muted bulk-hint">Sélectionnez 2 sorties pour comparer</span>
            )}
          </div>
          <div className="classify-bar-bulk">
            <select
              className="filter-select"
              value={bulkSession}
              onChange={(e) => setBulkSession(e.target.value)}
              aria-label="Type pour la sélection"
              disabled={busy}
            >
              <option value="">Type…</option>
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
                void runBulk(
                  {
                    activity_ids: selectedIds,
                    ...(bulkSession === '__clear__'
                      ? { clear_session_type: true }
                      : { session_type: bulkSession }),
                  },
                  'bulk-session',
                )
              }
            >
              {busyAction === 'bulk-session' ? '…' : 'Appliquer'}
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
                void runBulk(
                  {
                    activity_ids: selectedIds,
                    ...(bulkTerrain === '__clear__'
                      ? { clear_terrain: true }
                      : { terrain: bulkTerrain }),
                  },
                  'bulk-terrain',
                )
              }
            >
              {busyAction === 'bulk-terrain' ? '…' : 'Appliquer'}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-small"
              disabled={busy || selectedCount === 0}
              onClick={() => void autoClassify('selected')}
            >
              {busyAction === 'auto-selected' ? '…' : 'Auto-classer'}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-small"
              disabled={busy}
              onClick={() => setSelected(new Set())}
            >
              Vider
            </button>
          </div>
        </section>
      ) : null}

      {loading && activities.length === 0 ? (
        <div aria-busy="true" aria-label="Chargement des activités">
          <SkeletonList rows={6} />
        </div>
      ) : activities.length === 0 && !error ? (
        <EmptyState title="Aucune sortie" description="Synchronisez Strava depuis l’accueil." />
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
                Tout sélectionner
              </label>
            )}
          </div>
          {filtered.length === 0 ? (
            <EmptyState
              title="Aucun résultat"
              action={
                hasActiveFilters ? (
                  <button type="button" className="btn btn-ghost" onClick={resetFilters}>
                    Réinitialiser
                  </button>
                ) : undefined
              }
            />
          ) : (
            <ul className="activity-list">
              {filtered.map((activity) => (
                <li key={activity.id}>
                  <ActivityRow
                    activity={activity}
                    compact
                    selected={selected.has(activity.id)}
                    onToggleSelect={toggleSelect}
                    onSessionTypeSaved={(activityId, sessionType, label) => {
                      patchActivityLocal(activityId, {
                        session_type: sessionType,
                        session_type_label_fr: label,
                      })
                    }}
                    onTerrainSaved={(activityId, terrain, label) => {
                      patchActivityLocal(activityId, {
                        terrain,
                        terrain_label_fr: label,
                      })
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

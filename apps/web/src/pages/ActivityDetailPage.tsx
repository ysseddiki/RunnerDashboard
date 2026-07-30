import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ActivityDetail, AppleWorkout } from '../types'
import { formatDate, formatDuration, formatKm, formatPace } from '../format'
import { buildStreamPoints } from '../streams'
import { ActivityMap } from '../components/ActivityMap'
import { StreamCharts } from '../components/StreamCharts'
import { SessionInsights, FeatureTables } from '../components/SessionInsights'
import { SessionTypePicker } from '../components/SessionTypePicker'
import { TerrainPicker } from '../components/TerrainPicker'
import { apiFetch } from '../auth'

type AppleLinkInfo = {
  activity_id: number
  source: string
  apple_uuid: string | null
  linked_workout: AppleWorkout | null
  apple_candidates: Array<{
    workout: AppleWorkout
    score: number
    confidence: string
    reasons_fr: string[]
  }>
}

export function ActivityDetailPage() {
  const { id } = useParams()
  const [detail, setDetail] = useState<ActivityDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [appleLink, setAppleLink] = useState<AppleLinkInfo | null>(null)
  const [appleBusy, setAppleBusy] = useState(false)
  const [analyzeBusy, setAnalyzeBusy] = useState(false)

  function loadAppleLink(activityId: number) {
    return apiFetch(`/api/apple-health/activities/${activityId}/link`)
      .then(async (res) => {
        if (!res.ok) return null
        return (await res.json()) as AppleLinkInfo
      })
      .then((data) => setAppleLink(data))
      .catch(() => setAppleLink(null))
  }

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    setError(null)
    void apiFetch(`/api/activities/${id}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Détail HTTP ${res.status}`)
        return (await res.json()) as ActivityDetail
      })
      .then((data) => {
        if (!cancelled) {
          setDetail(data)
          void loadAppleLink(data.id)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Détail impossible')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  const points = useMemo(() => buildStreamPoints(detail?.streams_json), [detail?.streams_json])
  const activityId = detail?.id

  async function linkAppleWorkout(workoutId: number) {
    if (!activityId) return
    setAppleBusy(true)
    setError(null)
    try {
      const res = await apiFetch(`/api/apple-health/workouts/${workoutId}/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activity_id: activityId }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(typeof body.detail === 'string' ? body.detail : `Lien HTTP ${res.status}`)
      }
      const refreshed = await apiFetch(`/api/activities/${activityId}`)
      if (refreshed.ok) setDetail((await refreshed.json()) as ActivityDetail)
      await loadAppleLink(activityId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lien Apple impossible')
    } finally {
      setAppleBusy(false)
    }
  }

  async function unlinkApple(workoutId: number) {
    if (!activityId) return
    setAppleBusy(true)
    setError(null)
    try {
      const res = await apiFetch(`/api/apple-health/workouts/${workoutId}/unlink`, {
        method: 'POST',
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(typeof body.detail === 'string' ? body.detail : `Unlink HTTP ${res.status}`)
      }
      const refreshed = await apiFetch(`/api/activities/${activityId}`)
      if (refreshed.ok) setDetail((await refreshed.json()) as ActivityDetail)
      await loadAppleLink(activityId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Déliaison impossible')
    } finally {
      setAppleBusy(false)
    }
  }

  return (
    <section className="detail-view">
      <Link to="/activities" className="linkish back">
        ← Retour aux activités
      </Link>
      {error && <p className="banner error">{error}</p>}
      {loading && <p className="muted">Chargement du détail…</p>}
      {!loading && detail && activityId != null && (
        <>
          <header className="detail-hero">
            <div className="detail-meta">
              <SessionTypePicker
                activityId={activityId}
                value={detail.session_type}
                onSaved={(sessionType, label) => {
                  setDetail((prev) =>
                    prev
                      ? {
                          ...prev,
                          session_type: sessionType,
                          session_type_label_fr: label,
                        }
                      : prev,
                  )
                }}
              />
              <TerrainPicker
                activityId={activityId}
                value={detail.terrain}
                onSaved={(terrain, label) => {
                  setDetail((prev) =>
                    prev
                      ? {
                          ...prev,
                          terrain,
                          terrain_label_fr: label,
                        }
                      : prev,
                  )
                }}
              />
              <span>{formatDate(detail.start_date)}</span>
            </div>
            <h1>{detail.name}</h1>
            {(detail.source_label_fr || detail.source) && (
              <p className="muted">
                Source :{' '}
                <span
                  className={`source-badge ${
                    detail.source === 'apple'
                      ? 'source-apple'
                      : detail.apple_uuid
                        ? 'source-linked'
                        : 'source-strava'
                  }`}
                >
                  {detail.source_label_fr ?? detail.source}
                </span>
              </p>
            )}
          </header>

          <div className="stat-grid">
            <div className="stat">
              <span>Distance</span>
              <strong>{formatKm(detail.distance_m)}</strong>
            </div>
            <div className="stat">
              <span>Durée</span>
              <strong>{formatDuration(detail.moving_time_s)}</strong>
            </div>
            <div className="stat">
              <span>Allure moy.</span>
              <strong>{formatPace(detail.average_speed_mps)}</strong>
            </div>
            <div className="stat">
              <span>D+</span>
              <strong>
                {detail.total_elevation_gain_m != null
                  ? `${Math.round(detail.total_elevation_gain_m)} m`
                  : '—'}
              </strong>
            </div>
          </div>

          <section className="panel-block detail-coach-analysis">
            <div className="section-head">
              <h3 style={{ margin: 0 }}>Analyse coach</h3>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={analyzeBusy}
                onClick={() => {
                  void (async () => {
                    setAnalyzeBusy(true)
                    setError(null)
                    try {
                      const res = await apiFetch(`/api/coach/activities/${activityId}/analyze`, {
                        method: 'POST',
                      })
                      const body = await res.json().catch(() => ({}))
                      if (!res.ok) {
                        throw new Error(
                          typeof body.detail === 'string'
                            ? body.detail
                            : `Analyse HTTP ${res.status}`,
                        )
                      }
                      setDetail((prev) =>
                        prev
                          ? {
                              ...prev,
                              coach_analysis_json: body,
                              coach_analyzed_at: new Date().toISOString(),
                            }
                          : prev,
                      )
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Analyse impossible')
                    } finally {
                      setAnalyzeBusy(false)
                    }
                  })()
                }}
              >
                {analyzeBusy ? 'Analyse…' : detail.coach_analysis_json ? 'Relancer' : 'Analyser'}
              </button>
            </div>
            {detail.coach_analysis_json?.hints && detail.coach_analysis_json.hints.length > 0 && (
              <div className="insight-hints">
                {detail.coach_analysis_json.hints.map((h) => (
                  <div key={h.title} className="insight-hint">
                    <strong>{h.title}</strong>
                    <p>{h.text}</p>
                  </div>
                ))}
              </div>
            )}
            {detail.coach_analysis_json?.summary ? (
              <>
                <p className="coach-summary-text">{detail.coach_analysis_json.summary}</p>
                {detail.coach_analysis_json.markdown && (
                  <div className="coach-markdown">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {detail.coach_analysis_json.markdown}
                    </ReactMarkdown>
                  </div>
                )}
              </>
            ) : (
              <p className="muted">
                Pas encore d’analyse. Elle se lance aussi après Sync (nouvelles sorties), ou via le
                bouton.
              </p>
            )}
          </section>

          <div className="detail-block">
            <h3>Trace GPS</h3>
            <ActivityMap activity={detail} />
          </div>

          <div className="detail-block apple-link-panel">
            <h3>Lien Apple Santé</h3>
            {appleLink?.linked_workout ? (
              <>
                <p>
                  Lié à workout{' '}
                  <strong>
                    {appleLink.linked_workout.workout_type_label_fr ??
                      appleLink.linked_workout.workout_type}
                  </strong>
                  {appleLink.linked_workout.cadence_ppm != null
                    ? ` · cadence Apple ${appleLink.linked_workout.cadence_ppm} PPM`
                    : ''}
                </p>
                <button
                  type="button"
                  className="btn btn-small btn-ghost"
                  disabled={appleBusy}
                  onClick={() => void unlinkApple(appleLink.linked_workout!.id)}
                >
                  Délier
                </button>
                <p className="muted">
                  Délier ne retire pas les valeurs déjà enrichies (cadence / FC).
                </p>
              </>
            ) : appleLink?.apple_candidates?.length ? (
              <ul className="apple-import-list">
                {appleLink.apple_candidates.map((c) => (
                  <li key={c.workout.id}>
                    <div className="apple-candidate-row">
                      <span>
                        {c.workout.workout_type_label_fr ?? 'Séance'} · score {c.score} ·{' '}
                        {c.confidence}
                        <span className="muted"> ({c.reasons_fr.join(', ')})</span>
                      </span>
                      <button
                        type="button"
                        className="btn btn-small"
                        disabled={appleBusy}
                        onClick={() => void linkAppleWorkout(c.workout.id)}
                      >
                        Lier
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">
                Aucun workout Apple lié. Importez un export dans Admin pour proposer des
                candidats.
              </p>
            )}
          </div>

          <SessionInsights features={detail.features_json} sessionType={detail.session_type} />
          <FeatureTables features={detail.features_json} />

          <div className="detail-block">
            <h3>Graphs</h3>
            {points.length > 0 ? (
              <StreamCharts points={points} features={detail.features_json} />
            ) : (
              <p className="muted">Aucun stream stocké pour cette sortie.</p>
            )}
          </div>

          <div className="detail-secondary">
            <div className="kv-panel">
              <h3>Performance</h3>
              <dl className="kv">
                <div>
                  <dt>Durée totale</dt>
                  <dd>{formatDuration(detail.elapsed_time_s)}</dd>
                </div>
                <div>
                  <dt>Allure max</dt>
                  <dd>{formatPace(detail.max_speed_mps)}</dd>
                </div>
                <div>
                  <dt>FC moyenne</dt>
                  <dd>
                    {detail.average_heartrate != null
                      ? `${Math.round(detail.average_heartrate)} bpm`
                      : '—'}
                  </dd>
                </div>
                <div>
                  <dt>FC max</dt>
                  <dd>
                    {detail.max_heartrate != null
                      ? `${Math.round(detail.max_heartrate)} bpm`
                      : '—'}
                  </dd>
                </div>
                <div>
                  <dt>Cadence</dt>
                  <dd>{detail.cadence_ppm != null ? `${detail.cadence_ppm} PPM` : '—'}</dd>
                </div>
                <div>
                  <dt>Puissance</dt>
                  <dd>
                    {detail.average_watts != null
                      ? `${Math.round(detail.average_watts)} W`
                      : '—'}
                  </dd>
                </div>
                <div>
                  <dt>Calories</dt>
                  <dd>
                    {detail.calories != null ? `${Math.round(detail.calories)} kcal` : '—'}
                  </dd>
                </div>
                <div>
                  <dt>Travail</dt>
                  <dd>
                    {detail.kilojoules != null
                      ? `${Math.round(detail.kilojoules)} kJ`
                      : '—'}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="kv-panel">
              <h3>Météo</h3>
              {detail.weather_json ? (
                <dl className="kv">
                  <div>
                    <dt>Conditions</dt>
                    <dd>{detail.weather_json.weather_label_fr ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>Température</dt>
                    <dd>
                      {detail.weather_json.temperature_c != null
                        ? `${detail.weather_json.temperature_c} °C`
                        : '—'}
                      {detail.weather_json.apparent_temperature_c != null
                        ? ` (ressenti ${detail.weather_json.apparent_temperature_c} °C)`
                        : ''}
                    </dd>
                  </div>
                  <div>
                    <dt>Humidité</dt>
                    <dd>
                      {detail.weather_json.humidity_pct != null
                        ? `${detail.weather_json.humidity_pct} %`
                        : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt>Précip.</dt>
                    <dd>
                      {detail.weather_json.precipitation_mm != null
                        ? `${detail.weather_json.precipitation_mm} mm`
                        : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt>Vent</dt>
                    <dd>
                      {detail.weather_json.wind_speed_kmh != null
                        ? `${detail.weather_json.wind_speed_kmh} km/h`
                        : '—'}
                      {detail.weather_json.wind_direction_deg != null
                        ? ` · ${Math.round(detail.weather_json.wind_direction_deg)}°`
                        : ''}
                    </dd>
                  </div>
                  <div>
                    <dt>Relevé</dt>
                    <dd>{detail.weather_json.observed_at ?? '—'}</dd>
                  </div>
                </dl>
              ) : (
                <p className="muted" style={{ margin: 0 }}>
                  Pas de météo (GPS manquant, indoor, ou pas encore synchronisée).
                </p>
              )}
            </div>

            <div className="kv-panel">
              <h3>Contexte</h3>
              <dl className="kv">
                <div>
                  <dt>Appareil</dt>
                  <dd>{detail.device_name ?? '—'}</dd>
                </div>
                <div>
                  <dt>Indoor</dt>
                  <dd>{detail.trainer ? 'Oui' : 'Non'}</dd>
                </div>
                <div>
                  <dt>Fuseau</dt>
                  <dd>{detail.timezone ?? '—'}</dd>
                </div>
                <div>
                  <dt>GPS départ</dt>
                  <dd>
                    {detail.start_lat != null && detail.start_lng != null
                      ? `${detail.start_lat.toFixed(5)}, ${detail.start_lng.toFixed(5)}`
                      : '—'}
                  </dd>
                </div>
                <div>
                  <dt>Strava ID</dt>
                  <dd>{detail.strava_id ?? '—'}</dd>
                </div>
                <div>
                  <dt>Source</dt>
                  <dd>{detail.source_label_fr ?? detail.source ?? '—'}</dd>
                </div>
                <div>
                  <dt>Apple UUID</dt>
                  <dd className="truncate-id">{detail.apple_uuid ?? '—'}</dd>
                </div>
                <div>
                  <dt>Sync</dt>
                  <dd>{formatDate(detail.synced_at)}</dd>
                </div>
              </dl>
            </div>
          </div>
        </>
      )}
    </section>
  )
}

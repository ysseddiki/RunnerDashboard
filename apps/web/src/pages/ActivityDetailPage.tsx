import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { ActivityDetail } from '../types'
import { formatDate, formatDuration, formatKm, formatPace } from '../format'
import { buildStreamPoints } from '../streams'
import { ActivityMap } from '../components/ActivityMap'
import { StreamCharts } from '../components/StreamCharts'
import { SessionTypePicker } from '../components/SessionTypePicker'

export function ActivityDetailPage() {
  const { id } = useParams()
  const [detail, setDetail] = useState<ActivityDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    setError(null)
    void fetch(`/api/activities/${id}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Détail HTTP ${res.status}`)
        return (await res.json()) as ActivityDetail
      })
      .then((data) => {
        if (!cancelled) setDetail(data)
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
              <span>{formatDate(detail.start_date)}</span>
            </div>
            <h1>{detail.name}</h1>
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

          <div className="detail-block">
            <h3>Trace GPS</h3>
            <ActivityMap activity={detail} />
          </div>

          <div className="detail-block">
            <h3>Graphs</h3>
            {points.length > 0 ? (
              <StreamCharts points={points} />
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
                  <dd>{detail.strava_id}</dd>
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

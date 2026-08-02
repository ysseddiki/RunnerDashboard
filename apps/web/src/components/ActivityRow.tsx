import { Link } from 'react-router'
import type { ActivitySummary } from '../types'
import { formatDate, formatDuration, formatKm, formatPace } from '../format'
import { weatherVisual } from '../weatherVisual'
import { SessionTypePicker } from './SessionTypePicker'
import { TerrainPicker } from './TerrainPicker'
import { WeatherIcon } from './WeatherIcon'

type Props = {
  activity: ActivitySummary
  selected?: boolean
  onToggleSelect?: (activityId: number) => void
  onSessionTypeSaved?: (
    activityId: number,
    sessionType: string | null,
    label: string | null,
  ) => void
  onTerrainSaved?: (activityId: number, terrain: string | null, label: string | null) => void
  /** When false, body is not a link (e.g. detail page). Default true. */
  linkBody?: boolean
  /** Render title as h1 on detail page. */
  titleAs?: 'strong' | 'h1'
  /** Lecture seule : pas de pickers (accueil). */
  readOnly?: boolean
  /** Affichage dense (moins de métriques via CSS). */
  compact?: boolean
}

function sourceBadge(activity: ActivitySummary): { label: string; className: string } {
  if (activity.source === 'apple') {
    return { label: 'Apple', className: 'source-badge source-apple' }
  }
  if (activity.apple_uuid) {
    return { label: 'Strava+Apple', className: 'source-badge source-linked' }
  }
  return {
    label: activity.source_label_fr || 'Strava',
    className: 'source-badge source-strava',
  }
}

export function ActivityRow({
  activity,
  selected = false,
  onToggleSelect,
  onSessionTypeSaved,
  onTerrainSaved,
  linkBody = true,
  titleAs = 'strong',
  readOnly = false,
  compact = false,
}: Props) {
  const detailTo = `/activities/${activity.id}`
  const badge = sourceBadge(activity)
  const weather = activity.weather_json
  const hasWeather = weather?.temperature_c != null
  const visual = hasWeather
    ? weatherVisual(weather?.weather_code, weather?.weather_label_fr)
    : null

  const TitleTag = titleAs
  const heading = (
    <div className="activity-heading">
      <TitleTag className="activity-title">{activity.name}</TitleTag>
      <p className="activity-date">{formatDate(activity.start_date)}</p>
    </div>
  )

  const metrics = (
    <div className="activity-metrics">
      <div className="activity-metric">
        <span>Distance</span>
        <strong>{formatKm(activity.distance_m)}</strong>
      </div>
      <div className="activity-metric">
        <span>Temps</span>
        <strong>{formatDuration(activity.moving_time_s)}</strong>
      </div>
      <div className="activity-metric">
        <span>Allure</span>
        <strong>{formatPace(activity.average_speed_mps)}</strong>
      </div>
      <div className="activity-metric">
        <span>FC</span>
        <strong>
          {activity.average_heartrate != null
            ? `${Math.round(activity.average_heartrate)} bpm`
            : '—'}
        </strong>
      </div>
      <div className="activity-metric">
        <span>D+</span>
        <strong>
          {activity.total_elevation_gain_m != null
            ? `${Math.round(activity.total_elevation_gain_m)} m`
            : '—'}
        </strong>
      </div>
    </div>
  )

  const body = linkBody ? (
    <Link to={detailTo} className="activity-body-link">
      {heading}
      {metrics}
    </Link>
  ) : (
    <div className="activity-body-link is-static">
      {heading}
      {metrics}
    </div>
  )

  return (
    <article
      className={`activity${selected ? ' is-selected' : ''}${hasWeather ? ' has-weather' : ''}${
        !linkBody ? ' is-detail' : ''
      }${compact ? ' is-compact' : ''}${readOnly ? ' is-readonly' : ''}`}
    >
      {onToggleSelect && (
        <label className="activity-select">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(activity.id)}
            aria-label={`Sélectionner ${activity.name}`}
          />
        </label>
      )}
      <div className="activity-main">
        <div className="activity-controls">
          {readOnly ? (
            <>
              {activity.session_type_label_fr ? (
                <span className="chip session-tone-empty">{activity.session_type_label_fr}</span>
              ) : null}
              {activity.terrain_label_fr ? (
                <span className="chip terrain-tone-empty">{activity.terrain_label_fr}</span>
              ) : null}
              <span className={badge.className}>{badge.label}</span>
            </>
          ) : (
            <SessionTypePicker
              activityId={activity.id}
              value={activity.session_type}
              onSaved={(sessionType, label) => {
                onSessionTypeSaved?.(activity.id, sessionType, label)
              }}
            >
              <TerrainPicker
                activityId={activity.id}
                value={activity.terrain}
                onSaved={(terrain, label) => {
                  onTerrainSaved?.(activity.id, terrain, label)
                }}
              />
              <span className={badge.className}>{badge.label}</span>
            </SessionTypePicker>
          )}
        </div>
        {body}
      </div>

      {hasWeather && visual && (
        <div
          className={`activity-weather ${visual.className}`}
          title={visual.label}
          aria-label={`Météo : ${Math.round(weather!.temperature_c!)} degrés, ${visual.label}`}
        >
          <span className="activity-weather-icon">
            <WeatherIcon visual={visual} />
          </span>
          <div className="activity-weather-text">
            <strong>{Math.round(weather!.temperature_c!)}°C</strong>
            <span>{visual.label}</span>
          </div>
        </div>
      )}
    </article>
  )
}

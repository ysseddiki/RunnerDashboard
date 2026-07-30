import { Link } from 'react-router-dom'
import type { ActivitySummary } from '../types'
import { formatDate, formatKm, formatPace } from '../format'
import { SessionTypePicker } from './SessionTypePicker'

type Props = {
  activity: ActivitySummary
  onSessionTypeSaved?: (
    activityId: number,
    sessionType: string | null,
    label: string | null,
  ) => void
}

export function ActivityRow({ activity, onSessionTypeSaved }: Props) {
  const detailTo = `/activities/${activity.id}`

  return (
    <article className="activity">
      <div className="activity-top">
        <SessionTypePicker
          activityId={activity.id}
          value={activity.session_type}
          onSaved={(sessionType, label) => {
            onSessionTypeSaved?.(activity.id, sessionType, label)
          }}
        />
        <Link to={detailTo} className="activity-title-link">
          <strong>{activity.name}</strong>
        </Link>
      </div>
      <Link to={detailTo} className="activity-body-link">
        <p className="activity-date">{formatDate(activity.start_date)}</p>
        <div className="activity-metrics">
          <div className="activity-metric">
            <span>Distance</span>
            <strong>{formatKm(activity.distance_m)}</strong>
          </div>
          <div className="activity-metric">
            <span>Allure</span>
            <strong>{formatPace(activity.average_speed_mps)}</strong>
          </div>
          {activity.average_heartrate != null && (
            <div className="activity-metric">
              <span>FC</span>
              <strong>{Math.round(activity.average_heartrate)} bpm</strong>
            </div>
          )}
          {activity.total_elevation_gain_m != null && activity.total_elevation_gain_m > 0 && (
            <div className="activity-metric">
              <span>D+</span>
              <strong>{Math.round(activity.total_elevation_gain_m)} m</strong>
            </div>
          )}
          {activity.weather_json?.temperature_c != null && (
            <div className="activity-metric">
              <span>Météo</span>
              <strong>
                {Math.round(activity.weather_json.temperature_c)}°C
                {activity.weather_json.weather_label_fr
                  ? ` · ${activity.weather_json.weather_label_fr}`
                  : ''}
              </strong>
            </div>
          )}
        </div>
      </Link>
    </article>
  )
}

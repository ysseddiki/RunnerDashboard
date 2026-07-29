import { Link } from 'react-router-dom'
import type { ActivitySummary } from '../types'
import { formatDate, formatKm, formatPace } from '../format'
import { sessionToneClass } from '../sessionTone'

type Props = {
  activity: ActivitySummary
}

export function ActivityRow({ activity }: Props) {
  const tone = sessionToneClass(activity.session_type)

  return (
    <Link to={`/activities/${activity.id}`} className="activity">
      <div className="activity-top">
        {activity.session_type_label_fr ? (
          <span className={`chip ${tone}`}>{activity.session_type_label_fr}</span>
        ) : (
          <span className={`chip ${tone}`}>Non classé</span>
        )}
        <strong>{activity.name}</strong>
      </div>
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
  )
}

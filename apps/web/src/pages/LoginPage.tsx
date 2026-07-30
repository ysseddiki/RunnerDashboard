import { Navigate, useSearchParams } from 'react-router-dom'
import { stravaLoginUrl } from '../auth'
import { useAuth } from '../authContext'
import './LoginPage.css'

export function LoginPage() {
  const { user } = useAuth()
  const [params] = useSearchParams()
  const error = params.get('error')

  if (user) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="login-page">
      <div className="login-atmosphere" aria-hidden="true" />
      <div className="login-panel">
        <p className="login-brand">RunningDashboard</p>
        <h1 className="login-title">Connectez-vous avec Strava</h1>
        <p className="login-lead">
          Vos activités, profil et coach restent isolés à votre compte athlète.
        </p>
        {error && (
          <p className="login-error" role="alert">
            Connexion refusée ({error}). Réessayez.
          </p>
        )}
        <a className="btn primary login-cta" href={stravaLoginUrl()}>
          Continuer avec Strava
        </a>
      </div>
    </div>
  )
}

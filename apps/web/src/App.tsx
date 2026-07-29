import { useEffect, useState } from 'react'
import './App.css'

type HealthResponse = {
  status: string
  service: string
  version: string
  palier: string
}

function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const response = await fetch('/api/health')
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
        const data = (await response.json()) as HealthResponse
        if (!cancelled) {
          setHealth(data)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Impossible de joindre l’API',
          )
        }
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main className="page">
      <header className="brand">
        <p className="eyebrow">RunningDashboard</p>
        <h1>Socle P0 opérationnel</h1>
        <p className="lede">
          Application locale pour suivre vos sorties Strava, la météo associée
          et un coach IA hors ligne — étape par étape.
        </p>
      </header>

      <section className="status" aria-live="polite">
        <h2>État des services</h2>
        {error && (
          <p className="error">
            API injoignable ({error}). Vérifiez que le backend tourne.
          </p>
        )}
        {health && (
          <ul>
            <li>API : {health.status}</li>
            <li>Version : {health.version}</li>
            <li>Palier : {health.palier}</li>
          </ul>
        )}
        {!health && !error && <p>Vérification de l’API…</p>}
      </section>
    </main>
  )
}

export default App

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { AppSettings, HealthResponse, StravaStatus } from '../types'

type CoachStatus = {
  reachable: boolean
  model: string
  model_installed: boolean
  ready: boolean
  error: string | null
  installed_models: string[]
}

const MODEL_LABELS: Record<string, string> = {
  'qwen2.5:7b': 'Léger — qwen2.5:7b (~16 Go RAM)',
  'qwen2.5:14b': 'Recommandé — qwen2.5:14b (~32 Go RAM)',
}

export function AdminPage() {
  const [searchParams] = useSearchParams()
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [strava, setStrava] = useState<StravaStatus | null>(null)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [coachStatus, setCoachStatus] = useState<CoachStatus | null>(null)
  const [selectedModel, setSelectedModel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [cadenceBusy, setCadenceBusy] = useState(false)
  const [pullBusy, setPullBusy] = useState(false)

  const queryMessage = useMemo(() => {
    if (searchParams.get('strava') === 'connected') return 'Compte Strava connecté.'
    if (searchParams.get('strava') === 'error') {
      return `Connexion Strava échouée (${searchParams.get('reason') ?? 'inconnu'}).`
    }
    return null
  }, [searchParams])

  const refresh = useCallback(async () => {
    setError(null)
    const [healthRes, statusRes, settingsRes, coachRes] = await Promise.all([
      fetch('/api/health'),
      fetch('/api/strava/status'),
      fetch('/api/settings'),
      fetch('/api/coach/status'),
    ])
    if (!healthRes.ok) throw new Error(`Health HTTP ${healthRes.status}`)
    if (!statusRes.ok) throw new Error(`Status Strava HTTP ${statusRes.status}`)
    if (!settingsRes.ok) throw new Error(`Settings HTTP ${settingsRes.status}`)
    const [h, s, st] = await Promise.all([
      healthRes.json() as Promise<HealthResponse>,
      statusRes.json() as Promise<StravaStatus>,
      settingsRes.json() as Promise<AppSettings>,
    ])
    setHealth(h)
    setStrava(s)
    setSettings(st)
    setSelectedModel(st.ollama_model)
    if (coachRes.ok) {
      setCoachStatus((await coachRes.json()) as CoachStatus)
    } else {
      setCoachStatus(null)
    }
  }, [])

  useEffect(() => {
    void refresh().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'Chargement impossible')
    })
  }, [refresh])

  async function connectStrava() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/strava/auth-url')
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { detail?: string } | null
        throw new Error(body?.detail ?? `Auth URL HTTP ${res.status}`)
      }
      const data = (await res.json()) as { url: string }
      window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connexion impossible')
      setBusy(false)
    }
  }

  async function runSync() {
    setBusy(true)
    setSyncMessage(null)
    setError(null)
    try {
      const res = await fetch('/api/strava/sync', { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(
          typeof body.detail === 'string' ? body.detail : `Sync HTTP ${res.status}`,
        )
      }
      setSyncMessage(body.message as string)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync impossible')
    } finally {
      setBusy(false)
    }
  }

  async function saveSettings() {
    setSavingSettings(true)
    setSettingsMessage(null)
    setError(null)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ollama_model: selectedModel }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(
          typeof body.detail === 'string' ? body.detail : `Settings HTTP ${res.status}`,
        )
      }
      const st = body as AppSettings
      setSettings(st)
      setSelectedModel(st.ollama_model)
      setSettingsMessage('Modèle enregistré — le coach l’utilisera au prochain conseil.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible')
    } finally {
      setSavingSettings(false)
    }
  }

  async function pullModel() {
    setPullBusy(true)
    setSettingsMessage(null)
    setError(null)
    try {
      const res = await fetch('/api/coach/pull-model', { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(
          typeof body.detail === 'string' ? body.detail : `Pull HTTP ${res.status}`,
        )
      }
      setSettingsMessage(
        typeof body.message === 'string' ? body.message : 'Modèle téléchargé.',
      )
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Téléchargement modèle impossible')
    } finally {
      setPullBusy(false)
    }
  }

  async function recomputeCadence() {
    setCadenceBusy(true)
    setSyncMessage(null)
    setError(null)
    try {
      const res = await fetch('/api/activities/recompute-cadence', { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(
          typeof body.detail === 'string' ? body.detail : `Cadence HTTP ${res.status}`,
        )
      }
      setSyncMessage(typeof body.message === 'string' ? body.message : 'Cadence recalculée.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Recalcul cadence impossible')
    } finally {
      setCadenceBusy(false)
    }
  }

  return (
    <>
      <header className="page-hero">
        <h1>Admin</h1>
        <p>Connexion Strava, synchronisation et paramètres du coach IA.</p>
      </header>

      {error && <p className="banner error">{error}</p>}
      {queryMessage && <p className="banner ok">{queryMessage}</p>}
      {syncMessage && <p className="banner ok">{syncMessage}</p>}
      {settingsMessage && <p className="banner ok">{settingsMessage}</p>}

      <div className="admin-grid">
        <section className="admin-card">
          <h2>Strava</h2>
          <p className="muted">
            Importe les activités, streams GPS et enrichit la météo (quota limité par passage).
          </p>
          <dl className="kv">
            <div>
              <dt>Statut</dt>
              <dd>
                <span className="status-pill" style={{ padding: '0.2rem 0.6rem' }}>
                  <span className={`status-dot ${strava?.connected ? 'on' : ''}`} />
                  {strava?.connected ? 'Connecté' : 'Non connecté'}
                </span>
              </dd>
            </div>
            <div>
              <dt>Athlète</dt>
              <dd>{strava?.athlete_name ?? '—'}</dd>
            </div>
            <div>
              <dt>Athlete ID</dt>
              <dd>{strava?.athlete_id ?? '—'}</dd>
            </div>
          </dl>
          <div className="admin-actions">
            {strava?.connected ? (
              <button type="button" className="btn" onClick={() => void runSync()} disabled={busy}>
                {busy ? 'Sync…' : 'Synchroniser'}
              </button>
            ) : (
              <button
                type="button"
                className="btn"
                onClick={() => void connectStrava()}
                disabled={busy}
              >
                Connecter Strava
              </button>
            )}
          </div>
        </section>

        <section className="admin-card">
          <h2>Système</h2>
          <p className="muted">État de l’API et palier produit courant.</p>
          <dl className="kv">
            <div>
              <dt>API</dt>
              <dd>{health ? `${health.status} · ${health.version}` : '—'}</dd>
            </div>
            <div>
              <dt>Palier</dt>
              <dd>{health?.palier ?? '—'}</dd>
            </div>
          </dl>
        </section>

        <section className="admin-card">
          <h2>Cadence</h2>
          <p className="muted">
            Strava envoie la cadence en RPM (un pied). Conversion en PPM (×2) ; si la moyenne
            manque, le stream est utilisé. Recalcul local — pas besoin de resync.
          </p>
          <div className="admin-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void recomputeCadence()}
              disabled={cadenceBusy}
            >
              {cadenceBusy ? 'Recalcul…' : 'Recalculer les cadences'}
            </button>
          </div>
        </section>

        <section className="admin-card admin-span">
          <h2>Modèle IA (coach)</h2>
          <p className="muted">
            Choisissez 7B (VM ~16 Go) ou 14B (recommandé, ~32 Go), enregistrez, puis téléchargez
            le modèle. Ensuite ouvrez la page Coach.
          </p>
          {coachStatus && (
            <dl className="kv">
              <div>
                <dt>Ollama</dt>
                <dd>{coachStatus.reachable ? 'Joignable' : 'Injoignable'}</dd>
              </div>
              <div>
                <dt>Modèle actif</dt>
                <dd>{coachStatus.model}</dd>
              </div>
              <div>
                <dt>Installé</dt>
                <dd>{coachStatus.model_installed ? 'Oui' : 'Non'}</dd>
              </div>
              <div>
                <dt>Prêt coach</dt>
                <dd>{coachStatus.ready ? 'Oui' : 'Non'}</dd>
              </div>
            </dl>
          )}
          {settings && (
            <>
              <fieldset className="model-fieldset">
                <legend>Profil Ollama</legend>
                {settings.allowed_ollama_models.map((model) => (
                  <label key={model} className="model-option">
                    <input
                      type="radio"
                      name="ollama_model"
                      value={model}
                      checked={selectedModel === model}
                      onChange={() => setSelectedModel(model)}
                    />
                    <span>{MODEL_LABELS[model] ?? model}</span>
                  </label>
                ))}
              </fieldset>
              {selectedModel === 'qwen2.5:14b' && (
                <p className="banner warn">
                  Le profil 14B demande idéalement ~32 Go de RAM sur la VM.
                </p>
              )}
              <p className="muted">
                Source actuelle :{' '}
                {settings.ollama_model_source === 'db' ? 'UI (base)' : 'environnement (.env)'}
              </p>
              <div className="admin-actions">
                <button
                  type="button"
                  className="btn"
                  onClick={() => void saveSettings()}
                  disabled={savingSettings || selectedModel === settings.ollama_model}
                >
                  {savingSettings ? 'Enregistrement…' : 'Enregistrer le modèle'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => void pullModel()}
                  disabled={pullBusy || !coachStatus?.reachable}
                >
                  {pullBusy
                    ? 'Téléchargement (plusieurs minutes)…'
                    : 'Télécharger le modèle'}
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </>
  )
}

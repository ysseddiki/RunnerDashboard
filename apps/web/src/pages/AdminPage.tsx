import { useCallback, useEffect, useState } from 'react'
import type { AuthUser } from '../auth'
import { apiFetch } from '../auth'
import { useAuth } from '../authContext'
import type {
  AppSettings,
  AppleImportResult,
  CodeStorageReport,
  HealthResponse,
  StravaStatus,
} from '../types'

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
  const { user: me } = useAuth()
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [strava, setStrava] = useState<StravaStatus | null>(null)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [coachStatus, setCoachStatus] = useState<CoachStatus | null>(null)
  const [users, setUsers] = useState<AuthUser[]>([])
  const [selectedModel, setSelectedModel] = useState('')
  const [selectedNumThread, setSelectedNumThread] = useState('auto')
  const [error, setError] = useState<string | null>(null)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [cadenceBusy, setCadenceBusy] = useState(false)
  const [featuresBusy, setFeaturesBusy] = useState(false)
  const [clearTypesBusy, setClearTypesBusy] = useState(false)
  const [pullBusy, setPullBusy] = useState(false)
  const [usersBusy, setUsersBusy] = useState(false)
  const [appleBusy, setAppleBusy] = useState(false)
  const [appleMessage, setAppleMessage] = useState<string | null>(null)
  const [appleImport, setAppleImport] = useState<AppleImportResult | null>(null)
  const [storage, setStorage] = useState<CodeStorageReport | null>(null)
  const [storageBusy, setStorageBusy] = useState(false)

  const refresh = useCallback(async () => {
    setError(null)
    const [healthRes, statusRes, settingsRes, coachRes, usersRes, storageRes] =
      await Promise.all([
        apiFetch('/api/health'),
        apiFetch('/api/strava/status'),
        apiFetch('/api/admin/settings'),
        apiFetch('/api/coach/status'),
        apiFetch('/api/admin/users'),
        apiFetch('/api/admin/storage'),
      ])
    if (!healthRes.ok) throw new Error(`Health HTTP ${healthRes.status}`)
    if (!statusRes.ok) throw new Error(`Status Strava HTTP ${statusRes.status}`)
    if (!settingsRes.ok) throw new Error(`Settings HTTP ${settingsRes.status}`)
    if (!usersRes.ok) throw new Error(`Users HTTP ${usersRes.status}`)
    const [h, s, st, u] = await Promise.all([
      healthRes.json() as Promise<HealthResponse>,
      statusRes.json() as Promise<StravaStatus>,
      settingsRes.json() as Promise<AppSettings>,
      usersRes.json() as Promise<AuthUser[]>,
    ])
    setHealth(h)
    setStrava(s)
    setSettings(st)
    setSelectedModel(st.ollama_model)
    setSelectedNumThread(st.ollama_num_thread ?? 'auto')
    setUsers(u)
    if (coachRes.ok) {
      setCoachStatus((await coachRes.json()) as CoachStatus)
    } else {
      setCoachStatus(null)
    }
    if (storageRes.ok) {
      setStorage((await storageRes.json()) as CodeStorageReport)
    } else {
      setStorage(null)
    }
  }, [])

  async function refreshStorage() {
    setStorageBusy(true)
    setError(null)
    try {
      const res = await apiFetch('/api/admin/storage')
      if (!res.ok) throw new Error(`Stockage HTTP ${res.status}`)
      setStorage((await res.json()) as CodeStorageReport)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Inventaire stockage impossible')
    } finally {
      setStorageBusy(false)
    }
  }
  useEffect(() => {
    void refresh().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'Chargement impossible')
    })
  }, [refresh])

  async function runSync() {
    setBusy(true)
    setSyncMessage(null)
    setError(null)
    try {
      const res = await apiFetch('/api/strava/sync', { method: 'POST' })
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
      const payload: { ollama_model?: string; ollama_num_thread?: string } = {}
      if (settings && selectedModel !== settings.ollama_model) {
        payload.ollama_model = selectedModel
      }
      if (settings && selectedNumThread !== (settings.ollama_num_thread ?? 'auto')) {
        payload.ollama_num_thread = selectedNumThread
      }
      if (!payload.ollama_model && !payload.ollama_num_thread) {
        setSettingsMessage('Aucun changement à enregistrer.')
        return
      }
      const res = await apiFetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
      setSelectedNumThread(st.ollama_num_thread ?? 'auto')
      setSettingsMessage(
        'Réglages enregistrés — appliqués au prochain appel coach / analyse.',
      )
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
      const res = await apiFetch('/api/coach/pull-model', { method: 'POST' })
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

  async function toggleAdmin(target: AuthUser) {
    const nextRole = target.role === 'admin' ? 'user' : 'admin'
    setUsersBusy(true)
    setError(null)
    try {
      const res = await apiFetch(`/api/admin/users/${target.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: nextRole }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(
          typeof body.detail === 'string' ? body.detail : `Rôle HTTP ${res.status}`,
        )
      }
      setUsers((prev) => prev.map((u) => (u.id === target.id ? (body as AuthUser) : u)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Changement de rôle impossible')
    } finally {
      setUsersBusy(false)
    }
  }

  async function recomputeCadence() {
    setCadenceBusy(true)
    setSyncMessage(null)
    setError(null)
    try {
      const res = await apiFetch('/api/activities/recompute-cadence', { method: 'POST' })
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

  async function recomputeFeatures() {
    setFeaturesBusy(true)
    setSyncMessage(null)
    setError(null)
    try {
      const res = await apiFetch('/api/activities/recompute-features?force=true', {
        method: 'POST',
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(
          typeof body.detail === 'string' ? body.detail : `Features HTTP ${res.status}`,
        )
      }
      setSyncMessage(typeof body.message === 'string' ? body.message : 'Features recalculées.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Recalcul features impossible')
    } finally {
      setFeaturesBusy(false)
    }
  }

  async function clearSessionTypes() {
    if (
      !window.confirm(
        'Effacer vos types de séance ? Vos activités repasseront en « Non classé ».',
      )
    ) {
      return
    }
    setClearTypesBusy(true)
    setSyncMessage(null)
    setError(null)
    try {
      const res = await apiFetch('/api/admin/me/clear-session-types', { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(
          typeof body.detail === 'string' ? body.detail : `Types HTTP ${res.status}`,
        )
      }
      setSyncMessage(
        typeof body.message === 'string' ? body.message : 'Types de séance effacés.',
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Effacement des types impossible')
    } finally {
      setClearTypesBusy(false)
    }
  }

  async function importAppleZip(file: File) {
    setAppleBusy(true)
    setAppleMessage(null)
    setError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await apiFetch('/api/apple-health/import?auto_link=true&auto_promote=true', {
        method: 'POST',
        body: form,
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(
          typeof body.detail === 'string' ? body.detail : `Import Apple HTTP ${res.status}`,
        )
      }
      const result = body as AppleImportResult
      setAppleImport(result)
      setAppleMessage(result.message)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import Apple impossible')
    } finally {
      setAppleBusy(false)
    }
  }

  async function applyAppleLink(workoutId: number, activityId: number) {
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
      setAppleMessage(
        `Lien appliqué (activité #${activityId})${
          Array.isArray(body.enriched_fields) && body.enriched_fields.length
            ? ` · enrichi : ${body.enriched_fields.join(', ')}`
            : ''
        }`,
      )
      setAppleImport((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          items: prev.items.map((item) =>
            item.workout.id === workoutId
              ? {
                  ...item,
                  action: 'manual_linked',
                  workout: { ...item.workout, activity_id: activityId },
                  candidates: [],
                }
              : item,
          ),
        }
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lien impossible')
    } finally {
      setAppleBusy(false)
    }
  }

  async function promoteApple(workoutId: number) {
    setAppleBusy(true)
    setError(null)
    try {
      const res = await apiFetch(`/api/apple-health/workouts/${workoutId}/promote`, {
        method: 'POST',
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(
          typeof body.detail === 'string' ? body.detail : `Création HTTP ${res.status}`,
        )
      }
      setAppleMessage(`Activité Apple créée (#${body.activity_id})`)
      setAppleImport((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          items: prev.items.map((item) =>
            item.workout.id === workoutId
              ? {
                  ...item,
                  action: 'promoted',
                  workout: { ...item.workout, activity_id: body.activity_id },
                }
              : item,
          ),
        }
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Création impossible')
    } finally {
      setAppleBusy(false)
    }
  }

  return (
    <>
      <header className="page-hero">
        <h1>Admin</h1>
        <p>Utilisateurs, modèles Ollama, sync, stockage code et resets.</p>
      </header>

      {error && <p className="banner error">{error}</p>}
      {syncMessage && <p className="banner ok">{syncMessage}</p>}
      {settingsMessage && <p className="banner ok">{settingsMessage}</p>}
      {appleMessage && <p className="banner ok">{appleMessage}</p>}

      <div className="admin-grid">
        <section className="admin-card admin-span">
          <h2>Utilisateurs</h2>
          <p className="muted">
            Comptes arrivés via Strava. Le premier compte devient admin ; vous pouvez ensuite
            promouvoir d’autres utilisateurs.
          </p>
          <div className="admin-users-table-wrap">
            <table className="admin-users-table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Athlete ID</th>
                  <th>Rôle</th>
                  <th>Dernière connexion</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const name =
                    u.display_name ||
                    [u.firstname, u.lastname].filter(Boolean).join(' ') ||
                    `User #${u.id}`
                  const isSelf = me?.id === u.id
                  return (
                    <tr key={u.id}>
                      <td>
                        {name}
                        {isSelf ? ' (vous)' : ''}
                      </td>
                      <td>{u.strava_athlete_id}</td>
                      <td>{u.role}</td>
                      <td>
                        {u.last_login_at
                          ? new Date(u.last_login_at).toLocaleString('fr-FR')
                          : '—'}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-small btn-ghost"
                          disabled={usersBusy || (isSelf && u.role === 'admin')}
                          onClick={() => void toggleAdmin(u)}
                        >
                          {u.role === 'admin' ? 'Retirer admin' : 'Promouvoir admin'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-card">
          <h2>Strava (vos données)</h2>
          <p className="muted">
            Sync de votre compte uniquement. La connexion Strava se fait via la page Login.
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
          </dl>
          <div className="admin-actions">
            <button
              type="button"
              className="btn"
              onClick={() => void runSync()}
              disabled={busy || !strava?.connected}
            >
              {busy ? 'Sync…' : 'Synchroniser'}
            </button>
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
          <p className="muted">Recalcul local de vos cadences — pas besoin de resync.</p>
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

        <section className="admin-card">
          <h2>Features séance</h2>
          <p className="muted">
            Recalcule splits, zones FC, TRIMP pour vos activités.
          </p>
          <div className="admin-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void recomputeFeatures()}
              disabled={featuresBusy}
            >
              {featuresBusy ? 'Recalcul…' : 'Recalculer les features'}
            </button>
          </div>
        </section>

        <section className="admin-card">
          <h2>Types de séance</h2>
          <p className="muted">Remet vos activités en « Non classé ».</p>
          <div className="admin-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void clearSessionTypes()}
              disabled={clearTypesBusy}
            >
              {clearTypesBusy ? 'Effacement…' : 'Effacer vos types'}
            </button>
          </div>
        </section>

        <section className="admin-card admin-span">
          <h2>Import Apple Santé</h2>
          <p className="muted">
            Export ZIP iPhone → matching Strava sur vos données uniquement.
          </p>
          <div className="admin-actions">
            <label className={`btn ${appleBusy ? 'is-disabled' : ''}`}>
              {appleBusy ? 'Import…' : 'Choisir un ZIP export'}
              <input
                type="file"
                accept=".zip,application/zip"
                hidden
                disabled={appleBusy}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (file) void importAppleZip(file)
                }}
              />
            </label>
          </div>
          {appleImport && (
            <div className="apple-import-result">
              <p className="muted">
                {appleImport.total} workout(s) · liés auto {appleImport.auto_linked} · créés{' '}
                {appleImport.promoted}
              </p>
              <ul className="apple-import-list">
                {appleImport.items.slice(0, 40).map((item) => (
                  <li key={item.workout.id}>
                    <div className="apple-import-head">
                      <strong>
                        {item.workout.workout_type_label_fr ?? item.workout.workout_type ?? 'Séance'}
                      </strong>
                      <span className="muted">
                        {item.workout.start_date
                          ? new Date(item.workout.start_date).toLocaleString('fr-FR')
                          : '—'}
                        {item.workout.distance_m != null
                          ? ` · ${(item.workout.distance_m / 1000).toFixed(2)} km`
                          : ''}
                      </span>
                      <span className="chip">{item.action}</span>
                    </div>
                    {item.candidates.length > 0 && item.action !== 'auto_linked' && (
                      <div className="apple-candidates">
                        {item.candidates.map((c) => (
                          <div key={c.activity_id} className="apple-candidate-row">
                            <span>
                              Candidat : {c.activity_name} · score {c.score} · {c.confidence}
                              <span className="muted"> ({c.reasons_fr.join(', ')})</span>
                            </span>
                            <button
                              type="button"
                              className="btn btn-small"
                              disabled={appleBusy}
                              onClick={() => void applyAppleLink(item.workout.id, c.activity_id)}
                            >
                              Lier
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {!item.workout.activity_id && item.candidates.length === 0 && (
                      <button
                        type="button"
                        className="btn btn-small btn-ghost"
                        disabled={appleBusy}
                        onClick={() => void promoteApple(item.workout.id)}
                      >
                        Créer activité Apple
                      </button>
                    )}
                    {item.workout.activity_id && (
                      <p className="muted">
                        Lié à activité #{item.workout.activity_id}
                        {item.enriched_fields.length
                          ? ` · enrichi : ${item.enriched_fields.join(', ')}`
                          : ''}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="admin-card admin-span">
          <div className="section-head">
            <h2 style={{ margin: 0 }}>Stockage code</h2>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void refreshStorage()}
              disabled={storageBusy}
            >
              {storageBusy ? 'Mesure…' : 'Rafraîchir'}
            </button>
          </div>
          <p className="muted">
            Empreinte du code source (hors node_modules / .venv / dist / .git) et volume des
            dépendances.
          </p>
          {!storage && <p className="muted">Chargement de l’inventaire…</p>}
          {storage && !storage.available && (
            <p className="banner warn">{storage.reason_fr ?? 'Inventaire indisponible.'}</p>
          )}
          {storage?.available && storage.source && (
            <>
              <dl className="kv">
                <div>
                  <dt>Mode</dt>
                  <dd>{storage.mode_label_fr ?? storage.mode}</dd>
                </div>
                <div>
                  <dt>Racine</dt>
                  <dd>
                    <code className="admin-path">{storage.root}</code>
                  </dd>
                </div>
                <div>
                  <dt>Sources</dt>
                  <dd>
                    {storage.source.bytes_label} · {storage.source.files} fichiers ·{' '}
                    {storage.source.loc_total.toLocaleString('fr-FR')} lignes
                  </dd>
                </div>
                <div>
                  <dt>Dépendances</dt>
                  <dd>
                    {storage.dependencies?.bytes_label ?? '—'} ·{' '}
                    {storage.dependencies?.files?.toLocaleString('fr-FR') ?? '—'} fichiers
                  </dd>
                </div>
              </dl>
              {(storage.buckets?.length ?? 0) > 0 && (
                <div className="admin-storage-table-wrap">
                  <h3>Par dossier</h3>
                  <table className="admin-users-table">
                    <thead>
                      <tr>
                        <th>Chemin</th>
                        <th>Taille</th>
                        <th>Fichiers</th>
                        <th>LOC</th>
                      </tr>
                    </thead>
                    <tbody>
                      {storage.buckets!.slice(0, 12).map((b) => (
                        <tr key={b.id}>
                          <td>
                            <code>{b.id}</code>
                          </td>
                          <td>{b.bytes_label}</td>
                          <td>{b.files}</td>
                          <td>{b.loc.toLocaleString('fr-FR')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {(storage.languages?.length ?? 0) > 0 && (
                <div className="admin-storage-table-wrap">
                  <h3>Par langage</h3>
                  <table className="admin-users-table">
                    <thead>
                      <tr>
                        <th>Langage</th>
                        <th>Fichiers</th>
                        <th>LOC</th>
                      </tr>
                    </thead>
                    <tbody>
                      {storage.languages!.map((l) => (
                        <tr key={l.id}>
                          <td>{l.id}</td>
                          <td>{l.files}</td>
                          <td>{l.loc.toLocaleString('fr-FR')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {(storage.largest_files?.length ?? 0) > 0 && (
                <div className="admin-storage-table-wrap">
                  <h3>Plus gros fichiers sources</h3>
                  <table className="admin-users-table">
                    <thead>
                      <tr>
                        <th>Fichier</th>
                        <th>Taille</th>
                      </tr>
                    </thead>
                    <tbody>
                      {storage.largest_files!.slice(0, 8).map((f) => (
                        <tr key={f.path}>
                          <td>
                            <code className="admin-path">{f.path}</code>
                          </td>
                          <td>{f.bytes_label}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {storage.notes_fr && storage.notes_fr.length > 0 && (
                <ul className="muted admin-storage-notes">
                  {storage.notes_fr.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>

        <section className="admin-card admin-span">
          <h2>Modèle IA (coach)</h2>
          <p className="muted">
            Réglage instance : 7B (~16 Go) ou 14B (~32 Go). Réservé admin.
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
              <fieldset className="model-fieldset">
                <legend>Threads CPU (Ollama)</legend>
                <label className="model-option">
                  <input
                    type="radio"
                    name="ollama_num_thread"
                    checked={selectedNumThread === 'auto'}
                    onChange={() => setSelectedNumThread('auto')}
                  />
                  <span>
                    Auto — cœurs − 1
                    {settings.cpu_count
                      ? ` (effectif ~${Math.max(1, settings.cpu_count - 1)} / ${settings.cpu_count})`
                      : ''}
                  </span>
                </label>
                <label className="model-option">
                  <input
                    type="radio"
                    name="ollama_num_thread"
                    checked={selectedNumThread === '0'}
                    onChange={() => setSelectedNumThread('0')}
                  />
                  <span>Tous les cœurs (défaut Ollama)</span>
                </label>
                <label className="model-option">
                  <input
                    type="radio"
                    name="ollama_num_thread"
                    checked={selectedNumThread !== 'auto' && selectedNumThread !== '0'}
                    onChange={() =>
                      setSelectedNumThread(
                        settings.cpu_count && settings.cpu_count > 1
                          ? String(settings.cpu_count - 1)
                          : '4',
                      )
                    }
                  />
                  <span>Personnalisé</span>
                </label>
                {selectedNumThread !== 'auto' && selectedNumThread !== '0' && (
                  <label className="admin-inline-field">
                    Nombre de threads
                    <input
                      type="number"
                      min={1}
                      max={Math.max(settings.cpu_count ?? 64, 64)}
                      value={selectedNumThread}
                      onChange={(e) => setSelectedNumThread(e.target.value || '1')}
                    />
                  </label>
                )}
              </fieldset>
              <p className="muted">
                Threads : source{' '}
                {settings.ollama_num_thread_source === 'db' ? 'UI (base)' : 'environnement (.env)'}
                {settings.ollama_num_thread_effective != null
                  ? ` · effectif ${settings.ollama_num_thread_effective}`
                  : ' · effectif = tous (défaut Ollama)'}
                {' · '}Modèle :{' '}
                {settings.ollama_model_source === 'db' ? 'UI (base)' : 'environnement (.env)'}
              </p>
              <div className="admin-actions">
                <button
                  type="button"
                  className="btn"
                  onClick={() => void saveSettings()}
                  disabled={
                    savingSettings ||
                    (selectedModel === settings.ollama_model &&
                      selectedNumThread === (settings.ollama_num_thread ?? 'auto'))
                  }
                >
                  {savingSettings ? 'Enregistrement…' : 'Enregistrer'}
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

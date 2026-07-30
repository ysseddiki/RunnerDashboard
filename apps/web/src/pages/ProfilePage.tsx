import { useEffect, useState } from 'react'
import { ProjectionChart } from '../components/ProjectionChart'

type Profile = {
  age: number | null
  weight_kg: number | null
  height_cm: number | null
  sex: string | null
  resting_hr: number | null
  max_hr: number | null
  goal_text: string | null
  zones: {
    available: boolean
    method: string | null
    zones: Array<{ id: string; label_fr: string; hr_low: number; hr_high: number }>
    reason_fr: string | null
  }
  vo2max: {
    available: boolean
    vo2max_ml_kg_min: number | null
    method: string | null
    reason_fr: string | null
  }
}

type Projection = {
  available: boolean
  volume: Array<{ week: string; distance_km?: number; kind: string }>
  pace_10k: Array<{ week: string; pace_sec_per_km?: number; kind: string }>
  notes_fr: string[]
}

export function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [projection, setProjection] = useState<Projection | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    age: '',
    weight_kg: '',
    height_cm: '',
    sex: '',
    resting_hr: '',
    max_hr: '',
    goal_text: '',
  })

  function load() {
    void Promise.all([fetch('/api/profile'), fetch('/api/projections/overview')])
      .then(async ([pRes, jRes]) => {
        if (!pRes.ok) throw new Error(`Profil HTTP ${pRes.status}`)
        if (!jRes.ok) throw new Error(`Projection HTTP ${jRes.status}`)
        const [p, j] = await Promise.all([
          pRes.json() as Promise<Profile>,
          jRes.json() as Promise<Projection>,
        ])
        setProfile(p)
        setProjection(j)
        setForm({
          age: p.age != null ? String(p.age) : '',
          weight_kg: p.weight_kg != null ? String(p.weight_kg) : '',
          height_cm: p.height_cm != null ? String(p.height_cm) : '',
          sex: p.sex ?? '',
          resting_hr: p.resting_hr != null ? String(p.resting_hr) : '',
          max_hr: p.max_hr != null ? String(p.max_hr) : '',
          goal_text: p.goal_text ?? '',
        })
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Chargement impossible')
      })
  }

  useEffect(() => {
    load()
  }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const body = {
        age: form.age ? Number(form.age) : null,
        weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
        height_cm: form.height_cm ? Number(form.height_cm) : null,
        sex: form.sex || null,
        resting_hr: form.resting_hr ? Number(form.resting_hr) : null,
        max_hr: form.max_hr ? Number(form.max_hr) : null,
        goal_text: form.goal_text || null,
      }
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(typeof data.detail === 'string' ? data.detail : `Profil HTTP ${res.status}`)
      }
      const p = (await res.json()) as Profile
      setProfile(p)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <header className="page-hero">
        <h1>Profil coureur</h1>
        <p>
          Données locales pour zones FC et estimation VO2max (calculs déterministes). L’IA s’en sert
          pour commenter, pas pour inventer les chiffres.
        </p>
      </header>

      {error && <p className="banner error">{error}</p>}

      <form className="panel-block profile-form" onSubmit={(e) => void save(e)}>
        <h3>Identité & physiologie</h3>
        <div className="profile-grid">
          {(
            [
              ['age', 'Âge'],
              ['weight_kg', 'Poids (kg)'],
              ['height_cm', 'Taille (cm)'],
              ['resting_hr', 'FC repos'],
              ['max_hr', 'FC max'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="profile-field">
              <span>{label}</span>
              <input
                type="number"
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              />
            </label>
          ))}
          <label className="profile-field">
            <span>Sexe (optionnel)</span>
            <select
              value={form.sex}
              onChange={(e) => setForm((f) => ({ ...f, sex: e.target.value }))}
            >
              <option value="">—</option>
              <option value="F">F</option>
              <option value="M">M</option>
              <option value="X">Autre</option>
            </select>
          </label>
        </div>
        <label className="profile-field profile-field-full">
          <span>Objectif</span>
          <textarea
            rows={2}
            value={form.goal_text}
            onChange={(e) => setForm((f) => ({ ...f, goal_text: e.target.value }))}
            placeholder="Ex. Semi en moins de 1h45"
          />
        </label>
        <button type="submit" className="btn" disabled={saving}>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </form>

      {profile && (
        <div className="home-grid">
          <section className="panel-block">
            <h3>Zones FC</h3>
            {!profile.zones.available ? (
              <p className="muted">{profile.zones.reason_fr}</p>
            ) : (
              <ul className="pred-training-list">
                {profile.zones.zones.map((z) => (
                  <li key={z.id}>
                    <div className="pred-training-main">
                      <strong>
                        {z.id} · {z.label_fr}
                      </strong>
                    </div>
                    <strong className="pred-training-pace">
                      {z.hr_low}–{z.hr_high} bpm
                    </strong>
                  </li>
                ))}
              </ul>
            )}
            {profile.zones.method && (
              <p className="muted">Méthode : {profile.zones.method}</p>
            )}
          </section>
          <section className="panel-block">
            <h3>VO2max estimée</h3>
            {profile.vo2max.available ? (
              <p className="pred-hero-pace" style={{ fontSize: '2rem' }}>
                {profile.vo2max.vo2max_ml_kg_min}
                <span className="metric-unit"> ml/kg/min</span>
              </p>
            ) : (
              <p className="muted">{profile.vo2max.reason_fr}</p>
            )}
            {profile.vo2max.method && (
              <p className="muted">Méthode : {profile.vo2max.method} (approximation)</p>
            )}
          </section>
        </div>
      )}

      <section className="section">
        <div className="section-head">
          <h2>Projection d’évolution</h2>
        </div>
        {projection?.available ? (
          <>
            <ProjectionChart volume={projection.volume} pace10k={projection.pace_10k} />
            <ul className="docs-list">
              {projection.notes_fr.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </>
        ) : (
          <p className="muted">Pas encore de projection (historique insuffisant).</p>
        )}
      </section>
    </>
  )
}

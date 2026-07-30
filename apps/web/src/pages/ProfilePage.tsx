import { useEffect, useState } from 'react'
import { apiFetch } from '../auth'

type HistoryEntry = {
  id: number
  recorded_at: string | null
  birth_date: string | null
  age: number | null
  weight_kg: number | null
  height_cm: number | null
  sex: string | null
  resting_hr: number | null
  max_hr: number | null
  goal_text: string | null
}

type Profile = {
  birth_date: string | null
  age: number | null
  weight_kg: number | null
  height_cm: number | null
  sex: string | null
  resting_hr: number | null
  max_hr: number | null
  goal_text: string | null
  history: HistoryEntry[]
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

function formatRecordedAt(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function ageFromBirthDate(iso: string): number | null {
  if (!iso) return null
  const birth = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(birth.getTime())) return null
  const today = new Date()
  let years = today.getFullYear() - birth.getFullYear()
  const beforeBirthday =
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
  if (beforeBirthday) years -= 1
  return years >= 0 && years <= 120 ? years : null
}

export function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    birth_date: '',
    weight_kg: '',
    height_cm: '',
    sex: '',
    resting_hr: '',
    max_hr: '',
    goal_text: '',
  })

  const computedAge = ageFromBirthDate(form.birth_date)

  function applyProfile(p: Profile) {
    setProfile(p)
    setForm({
      birth_date: p.birth_date ?? '',
      weight_kg: p.weight_kg != null ? String(p.weight_kg) : '',
      height_cm: p.height_cm != null ? String(p.height_cm) : '',
      sex: p.sex ?? '',
      resting_hr: p.resting_hr != null ? String(p.resting_hr) : '',
      max_hr: p.max_hr != null ? String(p.max_hr) : '',
      goal_text: p.goal_text ?? '',
    })
  }

  function load() {
    void apiFetch('/api/profile')
      .then(async (pRes) => {
        if (!pRes.ok) throw new Error(`Profil HTTP ${pRes.status}`)
        return (await pRes.json()) as Profile
      })
      .then((p) => applyProfile(p))
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
        birth_date: form.birth_date || null,
        weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
        height_cm: form.height_cm ? Number(form.height_cm) : null,
        sex: form.sex || null,
        resting_hr: form.resting_hr ? Number(form.resting_hr) : null,
        max_hr: form.max_hr ? Number(form.max_hr) : null,
        goal_text: form.goal_text || null,
      }
      const res = await apiFetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const detail = data.detail
        const msg =
          typeof detail === 'string'
            ? detail
            : Array.isArray(detail)
              ? detail.map((d: { msg?: string }) => d.msg).filter(Boolean).join(' · ')
              : `Profil HTTP ${res.status}`
        throw new Error(msg || `Profil HTTP ${res.status}`)
      }
      const p = (await res.json()) as Profile
      applyProfile(p)
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
          Données locales pour zones FC et estimation VO2max (calculs déterministes). Chaque
          enregistrement est historisé. L’IA commente, elle n’invente pas les chiffres.
        </p>
      </header>

      {error && <p className="banner error">{error}</p>}

      <form className="panel-block profile-form" onSubmit={(e) => void save(e)}>
        <header className="profile-form-head">
          <h3>Identité & physiologie</h3>
          <p className="muted">
            Base pour zones FC et VO2max. L’âge est dérivé de la date de naissance.
          </p>
        </header>

        <fieldset className="profile-section">
          <legend>Identité</legend>
          <div className="profile-grid profile-grid-identity">
            <label className="profile-field profile-field-birth">
              <span>Date de naissance</span>
              <div className="profile-birth-row">
                <input
                  type="date"
                  value={form.birth_date}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setForm((f) => ({ ...f, birth_date: e.target.value }))}
                />
                {computedAge != null ? (
                  <span className="profile-age-pill">{computedAge} ans</span>
                ) : null}
              </div>
              {profile?.age != null && !form.birth_date ? (
                <span className="profile-field-hint">
                  Âge actuel {profile.age} ans — saisissez la date de naissance
                </span>
              ) : null}
            </label>
            <label className="profile-field">
              <span>Sexe</span>
              <select
                value={form.sex}
                onChange={(e) => setForm((f) => ({ ...f, sex: e.target.value }))}
              >
                <option value="">Non renseigné</option>
                <option value="F">Féminin</option>
                <option value="M">Masculin</option>
                <option value="X">Autre</option>
              </select>
            </label>
          </div>
        </fieldset>

        <fieldset className="profile-section">
          <legend>Morphologie</legend>
          <div className="profile-grid profile-grid-2">
            <label className="profile-field">
              <span>Poids</span>
              <div className="profile-input-unit">
                <input
                  type="number"
                  inputMode="decimal"
                  min={30}
                  max={250}
                  step={0.1}
                  value={form.weight_kg}
                  onChange={(e) => setForm((f) => ({ ...f, weight_kg: e.target.value }))}
                  placeholder="—"
                />
                <span className="profile-unit">kg</span>
              </div>
            </label>
            <label className="profile-field">
              <span>Taille</span>
              <div className="profile-input-unit">
                <input
                  type="number"
                  inputMode="numeric"
                  min={100}
                  max={250}
                  step={1}
                  value={form.height_cm}
                  onChange={(e) => setForm((f) => ({ ...f, height_cm: e.target.value }))}
                  placeholder="—"
                />
                <span className="profile-unit">cm</span>
              </div>
            </label>
          </div>
        </fieldset>

        <fieldset className="profile-section">
          <legend>Cardio</legend>
          <div className="profile-grid profile-grid-2">
            <label className="profile-field">
              <span>FC repos</span>
              <div className="profile-input-unit">
                <input
                  type="number"
                  inputMode="numeric"
                  min={30}
                  max={120}
                  value={form.resting_hr}
                  onChange={(e) => setForm((f) => ({ ...f, resting_hr: e.target.value }))}
                  placeholder="—"
                />
                <span className="profile-unit">bpm</span>
              </div>
            </label>
            <label className="profile-field">
              <span>FC max</span>
              <div className="profile-input-unit">
                <input
                  type="number"
                  inputMode="numeric"
                  min={100}
                  max={230}
                  value={form.max_hr}
                  onChange={(e) => setForm((f) => ({ ...f, max_hr: e.target.value }))}
                  placeholder="—"
                />
                <span className="profile-unit">bpm</span>
              </div>
            </label>
          </div>
        </fieldset>

        <fieldset className="profile-section">
          <legend>Objectif</legend>
          <label className="profile-field profile-field-full">
            <span className="visually-hidden">Objectif</span>
            <textarea
              rows={3}
              value={form.goal_text}
              onChange={(e) => setForm((f) => ({ ...f, goal_text: e.target.value }))}
              placeholder="Ex. Semi-marathon en moins de 1h45 — avril 2027"
            />
          </label>
        </fieldset>

        <div className="profile-form-actions">
          <button type="submit" className="btn" disabled={saving}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
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
          <h2>Historique du profil</h2>
        </div>
        {!profile?.history?.length ? (
          <p className="muted">Aucun enregistrement encore — sauvegardez le formulaire ci-dessus.</p>
        ) : (
          <div className="panel-block profile-history">
            <ul className="profile-history-list">
              {profile.history.map((h) => (
                <li key={h.id}>
                  <div className="profile-history-when">{formatRecordedAt(h.recorded_at)}</div>
                  <div className="profile-history-metrics">
                    {h.age != null && <span>{h.age} ans</span>}
                    {h.weight_kg != null && <span>{h.weight_kg} kg</span>}
                    {h.height_cm != null && <span>{h.height_cm} cm</span>}
                    {h.resting_hr != null && <span>FC repos {h.resting_hr}</span>}
                    {h.max_hr != null && <span>FC max {h.max_hr}</span>}
                    {h.sex && <span>{h.sex}</span>}
                  </div>
                  {h.goal_text && <p className="profile-history-goal">{h.goal_text}</p>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </>
  )
}

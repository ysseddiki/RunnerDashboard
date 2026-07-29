import { useEffect, useState } from 'react'

type Props = {
  activityId: number
  value: number | null | undefined
  onSaved: (cadencePpm: number | null) => void
}

export function CadenceEditor({ activityId, value, onSaved }: Props) {
  const [input, setInput] = useState(value != null ? String(value) : '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  useEffect(() => {
    setInput(value != null ? String(value) : '')
  }, [value])

  async function save() {
    setSaving(true)
    setError(null)
    setOk(null)
    try {
      const trimmed = input.trim()
      const body =
        trimmed === ''
          ? { clear_cadence: true }
          : { cadence_ppm: Number(trimmed) }

      if ('cadence_ppm' in body && Number.isNaN(body.cadence_ppm)) {
        throw new Error('Cadence invalide')
      }

      const res = await fetch(`/api/activities/${activityId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        const detail = payload.detail
        const message =
          typeof detail === 'string'
            ? detail
            : Array.isArray(detail)
              ? detail.map((d: { msg?: string }) => d.msg).join(', ')
              : `Enregistrement HTTP ${res.status}`
        throw new Error(message)
      }
      const next =
        typeof payload.cadence_ppm === 'number' ? payload.cadence_ppm : null
      onSaved(next)
      setOk(next == null ? 'Cadence effacée.' : 'Cadence enregistrée.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible')
    } finally {
      setSaving(false)
    }
  }

  const current = value != null ? String(value) : ''
  const dirty = input.trim() !== current

  return (
    <div className="session-type-box">
      <label className="session-type-label" htmlFor="cadence-ppm">
        Cadence moyenne (PPM)
      </label>
      <p className="muted session-type-help">
        Si Strava n’a pas la cadence (souvent Apple Watch), saisissez la valeur affichée dans
        Forme / Apple Watch (ex. 170).
      </p>
      <div className="session-type-row">
        <input
          id="cadence-ppm"
          type="number"
          min={80}
          max={250}
          step={0.1}
          placeholder="ex. 170"
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
            setOk(null)
          }}
          disabled={saving}
        />
        <button type="button" className="btn" onClick={() => void save()} disabled={saving || !dirty}>
          {saving ? '…' : 'Enregistrer'}
        </button>
      </div>
      {error && <p className="banner error">{error}</p>}
      {ok && <p className="banner ok">{ok}</p>}
    </div>
  )
}

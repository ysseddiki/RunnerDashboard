import { useEffect, useState } from 'react'
import type { SessionTypeInfo } from '../types'

type Props = {
  activityId: number
  value: string | null | undefined
  onSaved: (sessionType: string | null, label: string | null) => void
}

export function SessionTypePicker({ activityId, value, onSaved }: Props) {
  const [types, setTypes] = useState<SessionTypeInfo[]>([])
  const [selected, setSelected] = useState(value ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  useEffect(() => {
    setSelected(value ?? '')
  }, [value])

  useEffect(() => {
    let cancelled = false
    void fetch('/api/activities/session-types')
      .then(async (res) => {
        if (!res.ok) throw new Error(`Types HTTP ${res.status}`)
        return (await res.json()) as SessionTypeInfo[]
      })
      .then((data) => {
        if (!cancelled) setTypes(data)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Catalogue types indisponible')
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function save() {
    setSaving(true)
    setError(null)
    setOk(null)
    try {
      const res = await fetch(`/api/activities/${activityId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_type: selected || null }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        const detail = body.detail
        const message =
          typeof detail === 'string'
            ? detail
            : Array.isArray(detail)
              ? detail.map((d: { msg?: string }) => d.msg).join(', ')
              : `Enregistrement HTTP ${res.status}`
        throw new Error(message)
      }
      const label =
        typeof body.session_type_label_fr === 'string' ? body.session_type_label_fr : null
      const nextType = typeof body.session_type === 'string' ? body.session_type : null
      onSaved(nextType, label)
      setOk('Type de séance enregistré.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible')
    } finally {
      setSaving(false)
    }
  }

  const dirty = (selected || '') !== (value ?? '')

  return (
    <div className="session-type-box">
      <label className="session-type-label" htmlFor="session-type">
        Type de séance
      </label>
      <p className="muted session-type-help">
        Attribuez EF, fractionné, seuil… pour que le coach IA analyse mieux chaque sortie.
      </p>
      <div className="session-type-row">
        <select
          id="session-type"
          value={selected}
          onChange={(e) => {
            setSelected(e.target.value)
            setOk(null)
          }}
          disabled={saving || types.length === 0}
        >
          <option value="">Non classé</option>
          {types.map((t) => (
            <option key={t.id} value={t.id} title={t.description_fr}>
              {t.label_fr}
            </option>
          ))}
        </select>
        <button type="button" className="btn" onClick={() => void save()} disabled={saving || !dirty}>
          {saving ? '…' : 'Enregistrer'}
        </button>
      </div>
      {selected && types.find((t) => t.id === selected) && (
        <p className="muted session-type-desc">
          {types.find((t) => t.id === selected)?.description_fr}
        </p>
      )}
      {error && <p className="banner error">{error}</p>}
      {ok && <p className="banner ok">{ok}</p>}
    </div>
  )
}

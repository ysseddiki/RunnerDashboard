import { useEffect, useId, useRef, useState } from 'react'
import type { SessionTypeInfo } from '../types'
import { sessionToneClass } from '../sessionTone'

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
  const selectId = useId()
  const requestId = useRef(0)

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

  async function persist(next: string) {
    const id = ++requestId.current
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/activities/${activityId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_type: next || null }),
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
      if (id !== requestId.current) return
      const label =
        typeof body.session_type_label_fr === 'string' ? body.session_type_label_fr : null
      const nextType = typeof body.session_type === 'string' ? body.session_type : null
      onSaved(nextType, label)
    } catch (err) {
      if (id !== requestId.current) return
      setSelected(value ?? '')
      setError(err instanceof Error ? err.message : 'Enregistrement impossible')
    } finally {
      if (id === requestId.current) setSaving(false)
    }
  }

  const current = types.find((t) => t.id === selected)
  const tone = sessionToneClass(selected || null)

  return (
    <div className={`session-tag ${tone} ${saving ? 'is-saving' : ''}`}>
      <label className="visually-hidden" htmlFor={selectId}>
        Type de séance
      </label>
      <select
        id={selectId}
        className="session-tag-select"
        value={selected}
        title={current?.description_fr ?? 'Attribuer un type de séance'}
        disabled={saving || types.length === 0}
        onChange={(e) => {
          const next = e.target.value
          setSelected(next)
          void persist(next)
        }}
      >
        <option value="">Non classé</option>
        {types.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label_fr}
          </option>
        ))}
      </select>
      {error && <span className="session-tag-error">{error}</span>}
    </div>
  )
}

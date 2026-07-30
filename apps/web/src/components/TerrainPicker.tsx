import { useEffect, useId, useRef, useState } from 'react'
import { useTerrains } from '../useTerrains'
import { apiFetch } from '../auth'

type Props = {
  activityId: number
  value: string | null | undefined
  onSaved: (terrain: string | null, label: string | null) => void
}

export function TerrainPicker({ activityId, value, onSaved }: Props) {
  const { terrains, error: catalogError } = useTerrains()
  const [selected, setSelected] = useState(value ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const selectId = useId()
  const requestId = useRef(0)

  useEffect(() => {
    setSelected(value ?? '')
  }, [value, activityId])

  useEffect(() => {
    if (catalogError) setError(catalogError)
  }, [catalogError])

  async function persist(next: string) {
    const id = ++requestId.current
    setSaving(true)
    setError(null)
    try {
      const res = await apiFetch(`/api/activities/${activityId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ terrain: next || null }),
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
      const label = typeof body.terrain_label_fr === 'string' ? body.terrain_label_fr : null
      const nextTerrain = typeof body.terrain === 'string' ? body.terrain : null
      onSaved(nextTerrain, label)
    } catch (err) {
      if (id !== requestId.current) return
      setSelected(value ?? '')
      setError(err instanceof Error ? err.message : 'Enregistrement impossible')
    } finally {
      if (id === requestId.current) setSaving(false)
    }
  }

  const current = terrains.find((t) => t.id === selected)
  const tone = selected ? `terrain-tone-${selected}` : 'terrain-tone-empty'

  return (
    <div
      className={`terrain-tag ${tone} ${saving ? 'is-saving' : ''}`}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <label className="visually-hidden" htmlFor={selectId}>
        Terrain
      </label>
      <div className="terrain-tag-control">
        <select
          id={selectId}
          className="terrain-tag-select"
          value={selected}
          title={current?.description_fr ?? 'Contexte terrain'}
          disabled={saving || terrains.length === 0}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onChange={(e) => {
            const next = e.target.value
            setSelected(next)
            void persist(next)
          }}
        >
          <option value="">Terrain —</option>
          {terrains.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label_fr}
            </option>
          ))}
        </select>
      </div>
      {error && <span className="session-tag-error">{error}</span>}
    </div>
  )
}

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { sessionToneClass } from '../sessionTone'
import { useSessionTypes } from '../useSessionTypes'

type Suggestion = {
  suggested_session_type: string
  confidence: string
  source: string
  rationale_fr: string
  label_fr: string | null
}

type Props = {
  activityId: number
  value: string | null | undefined
  onSaved: (sessionType: string | null, label: string | null) => void
  /** Contenu sur la même ligne (badge, titre…). Le panneau suggestion passe en dessous. */
  children?: ReactNode
}

export function SessionTypePicker({ activityId, value, onSaved, children }: Props) {
  const { types, error: catalogError } = useSessionTypes()
  const [selected, setSelected] = useState(value ?? '')
  const [saving, setSaving] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null)
  const [error, setError] = useState<string | null>(null)
  const selectId = useId()
  const requestId = useRef(0)

  useEffect(() => {
    setSelected(value ?? '')
    setSuggestion(null)
  }, [value, activityId])

  useEffect(() => {
    if (catalogError) setError(catalogError)
  }, [catalogError])

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
      setSuggestion(null)
      onSaved(nextType, label)
    } catch (err) {
      if (id !== requestId.current) return
      setSelected(value ?? '')
      setError(err instanceof Error ? err.message : 'Enregistrement impossible')
    } finally {
      if (id === requestId.current) setSaving(false)
    }
  }

  async function suggest() {
    setSuggesting(true)
    setError(null)
    try {
      const res = await fetch(`/api/activities/${activityId}/suggest-session-type`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ use_ai: false }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(
          typeof body.detail === 'string' ? body.detail : `Suggestion HTTP ${res.status}`,
        )
      }
      setSuggestion(body as Suggestion)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Suggestion impossible')
    } finally {
      setSuggesting(false)
    }
  }

  function applySuggestion() {
    if (!suggestion) return
    setSelected(suggestion.suggested_session_type)
    void persist(suggestion.suggested_session_type)
  }

  const current = types.find((t) => t.id === selected)
  const tone = sessionToneClass(selected || null)

  return (
    <div
      className={`session-tag-wrap ${saving ? 'is-saving' : ''}`}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="activity-top-line">
        <div className={`session-tag ${tone}`}>
          <label className="visually-hidden" htmlFor={selectId}>
            Type de séance
          </label>
          <div className="session-tag-control">
            <select
              id={selectId}
              className="session-tag-select"
              value={selected}
              title={current?.description_fr ?? 'Attribuer un type de séance'}
              disabled={saving || types.length === 0}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
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
          </div>
          <button
            type="button"
            className="session-suggest-btn"
            disabled={saving || suggesting}
            title="Suggérer un type à partir de l’allure, distance et titre"
            onClick={(e) => {
              e.stopPropagation()
              void suggest()
            }}
          >
            {suggesting ? '…' : 'Suggérer'}
          </button>
        </div>
        {children}
      </div>
      {suggestion && (
        <div className="session-suggest-panel">
          <p>
            Proposition : <strong>{suggestion.label_fr ?? suggestion.suggested_session_type}</strong>{' '}
            <span className="muted">
              ({suggestion.confidence} · {suggestion.source})
            </span>
          </p>
          <p className="session-suggest-rationale">{suggestion.rationale_fr}</p>
          <div className="session-suggest-actions">
            <button type="button" className="btn btn-small" onClick={applySuggestion} disabled={saving}>
              Appliquer
            </button>
            <button
              type="button"
              className="btn btn-small btn-ghost"
              onClick={() => setSuggestion(null)}
            >
              Ignorer
            </button>
          </div>
        </div>
      )}
      {error && <span className="session-tag-error">{error}</span>}
    </div>
  )
}

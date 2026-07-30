import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { apiFetch } from '../auth'
import { getSessionTypeDoc } from '../sessionTypeDocs'
import { sessionToneClass } from '../sessionTone'
import { useSessionTypes } from '../useSessionTypes'

type Suggestion = {
  suggested_session_type: string
  confidence: string
  source: string
  rationale_fr: string
  label_fr: string | null
}

type MenuPos = { top: number; left: number; width: number }

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
  const [open, setOpen] = useState(false)
  const [helpId, setHelpId] = useState<string | null>(null)
  const [menuPos, setMenuPos] = useState<MenuPos | null>(null)
  const [saving, setSaving] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null)
  const [error, setError] = useState<string | null>(null)
  const listId = useId()
  const requestId = useRef(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setSelected(value ?? '')
    setSuggestion(null)
    setHelpId(null)
    setOpen(false)
  }, [value, activityId])

  useEffect(() => {
    if (catalogError) setError(catalogError)
  }, [catalogError])

  function updateMenuPosition(withHelp = Boolean(helpId)) {
    const el = triggerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const maxW = window.innerWidth - 16
    const baseW = Math.min(Math.max(rect.width, 280), Math.min(420, maxW))
    const helpExtra = withHelp && window.innerWidth > 640 ? Math.min(320, Math.max(240, maxW - baseW)) : 0
    const width = Math.min(baseW + helpExtra, maxW)
    let left = rect.left
    if (left + width > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - width - 8)
    }
    const estimatedHeight = Math.min(window.innerHeight * 0.5, 320)
    const spaceBelow = window.innerHeight - rect.bottom - 8
    const top =
      spaceBelow < estimatedHeight && rect.top > estimatedHeight
        ? Math.max(8, rect.top - estimatedHeight - 6)
        : rect.bottom + 6
    setMenuPos({ top, left, width })
  }

  useLayoutEffect(() => {
    if (!open) {
      setMenuPos(null)
      return
    }
    updateMenuPosition(Boolean(helpId))
    function onReposition() {
      updateMenuPosition(Boolean(helpId))
    }
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    return () => {
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
  }, [open, helpId])

  useEffect(() => {
    if (!open) return
    function onDocPointer(e: PointerEvent) {
      const target = e.target as Node
      if (rootRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      setOpen(false)
      setHelpId(null)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        setHelpId(null)
      }
    }
    document.addEventListener('pointerdown', onDocPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDocPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  async function persist(next: string) {
    const id = ++requestId.current
    setSaving(true)
    setError(null)
    try {
      const res = await apiFetch(`/api/activities/${activityId}`, {
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
      setOpen(false)
      setHelpId(null)
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
      const res = await apiFetch(`/api/activities/${activityId}/suggest-session-type`, {
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
  const currentDoc = getSessionTypeDoc(selected)
  const tone = sessionToneClass(selected || null)
  const triggerLabel = current?.label_fr ?? 'Non classé'
  const helpDoc = helpId ? getSessionTypeDoc(helpId) : null

  const menu =
    open && menuPos
      ? createPortal(
          <div
            ref={menuRef}
            className="session-type-menu session-type-menu-portal"
            id={listId}
            role="listbox"
            style={{
              top: menuPos.top,
              left: menuPos.left,
              width: menuPos.width,
            }}
          >
            <div className="session-type-menu-scroll">
              <button
                type="button"
                role="option"
                aria-selected={!selected}
                className={`session-type-option${!selected ? ' is-active' : ''}`}
                onClick={() => {
                  setSelected('')
                  void persist('')
                }}
              >
                <span className="session-type-option-label">Non classé</span>
              </button>
              {types.map((t) => {
                const doc = getSessionTypeDoc(t.id)
                const isActive = selected === t.id
                const helpOpen = helpId === t.id
                return (
                  <div
                    key={t.id}
                    className={`session-type-option-row${isActive ? ' is-active' : ''}`}
                  >
                    <button
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      className="session-type-option"
                      onClick={() => {
                        setSelected(t.id)
                        void persist(t.id)
                      }}
                    >
                      <span className="session-type-option-label">{t.label_fr}</span>
                    </button>
                    {doc && (
                      <button
                        type="button"
                        className={`session-type-help-btn${helpOpen ? ' is-open' : ''}`}
                        aria-label={`Aide : ${t.label_fr}`}
                        aria-expanded={helpOpen}
                        title="Rappel doc de ce type"
                        onClick={(e) => {
                          e.stopPropagation()
                          setHelpId((cur) => (cur === t.id ? null : t.id))
                        }}
                      >
                        ?
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
            {helpDoc && (
              <aside className="session-type-help-panel" aria-live="polite">
                <p className="session-type-help-title">{helpDoc.label}</p>
                <p className="session-type-help-summary">{helpDoc.summary}</p>
                <dl className="session-type-help-dl">
                  <div>
                    <dt>Pourquoi</dt>
                    <dd>{helpDoc.purpose}</dd>
                  </div>
                  <div>
                    <dt>Sensation</dt>
                    <dd>{helpDoc.feel}</dd>
                  </div>
                  <div>
                    <dt>Typique</dt>
                    <dd>{helpDoc.typical}</dd>
                  </div>
                  <div>
                    <dt>Zones</dt>
                    <dd>{helpDoc.zones}</dd>
                  </div>
                  <div>
                    <dt>Conseil</dt>
                    <dd>{helpDoc.tips}</dd>
                  </div>
                </dl>
                <Link
                  to="/docs?tab=seances"
                  className="inline-link session-type-help-link"
                  onClick={() => setOpen(false)}
                >
                  Voir toute la doc
                </Link>
              </aside>
            )}
          </div>,
          document.body,
        )
      : null

  return (
    <div
      ref={rootRef}
      className={`session-tag-wrap ${saving ? 'is-saving' : ''}`}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="activity-top-line">
        <div className={`session-tag ${tone}`}>
          <div className="session-tag-control">
            <button
              ref={triggerRef}
              type="button"
              className="session-tag-trigger"
              aria-haspopup="listbox"
              aria-expanded={open}
              aria-controls={open ? listId : undefined}
              disabled={saving || types.length === 0}
              title={currentDoc?.summary ?? current?.description_fr ?? 'Attribuer un type de séance'}
              onClick={(e) => {
                e.stopPropagation()
                setOpen((v) => !v)
                if (open) setHelpId(null)
              }}
            >
              <span className="session-tag-trigger-label">{triggerLabel}</span>
              <span className="session-tag-caret" aria-hidden="true" />
            </button>
            {menu}
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
          {getSessionTypeDoc(suggestion.suggested_session_type) && (
            <p className="muted session-suggest-doc-hint">
              {getSessionTypeDoc(suggestion.suggested_session_type)!.summary}
            </p>
          )}
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

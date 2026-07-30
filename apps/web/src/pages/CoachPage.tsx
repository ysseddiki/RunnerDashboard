import { useEffect, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { sessionToneClass } from '../sessionTone'
import { useSessionTypes } from '../useSessionTypes'

type CoachStatus = {
  reachable: boolean
  model: string
  model_installed: boolean
  ready: boolean
  error: string | null
  installed_models: string[]
  chat_timeout_s?: number
}

type PlanItem = {
  date: string | null
  session_type: string | null
  title: string
  details: string
  target_pace: string | null
  duration_or_distance: string | null
}

type AdviseResponse = {
  model: string
  answer: string
  summary: string
  plan: PlanItem[]
  markdown: string
  structured: boolean
  context_summary: {
    predictions_available?: boolean
    confidence?: string
    analytics_category?: string
    recent_activities?: number
  }
}

function formatPlanDate(iso: string | null): string {
  if (!iso) return 'À planifier'
  const d = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

function looksLikeJson(text: string): boolean {
  const s = text.trim()
  return s.startsWith('{') && (s.includes('"summary"') || s.includes('"plan"'))
}

function normalizePlanItem(item: unknown): PlanItem | null {
  if (!item || typeof item !== 'object') return null
  const row = item as Record<string, unknown>
  const title = String(row.title ?? row.name ?? 'Séance')
  return {
    date: row.date != null ? String(row.date) : null,
    session_type: row.session_type != null ? String(row.session_type) : null,
    title,
    details: String(row.details ?? row.description ?? ''),
    target_pace: row.target_pace != null && row.target_pace !== '' ? String(row.target_pace) : null,
    duration_or_distance:
      row.duration_or_distance != null && row.duration_or_distance !== ''
        ? String(row.duration_or_distance)
        : null,
  }
}

function planToMarkdown(plan: PlanItem[]): string {
  if (!plan.length) return ''
  const lines = ['## Plan proposé', '']
  for (const item of plan) {
    lines.push(`### ${item.date ?? 'À planifier'} — ${item.title}`)
    if (item.details) lines.push(item.details)
    const meta: string[] = []
    if (item.duration_or_distance) meta.push(`**Volume** : ${item.duration_or_distance}`)
    if (item.target_pace) meta.push(`**Allure** : ${item.target_pace}`)
    if (meta.length) {
      lines.push('')
      for (const m of meta) lines.push(`- ${m}`)
    }
    lines.push('')
  }
  return lines.join('\n').trim()
}

/** Repli UI si l’API renvoie encore du JSON brut. */
function normalizeAdvise(raw: AdviseResponse): AdviseResponse {
  const blob = [raw.markdown, raw.answer, raw.summary].find((t) => looksLikeJson(t || ''))
  if (!blob) {
    if (looksLikeJson(raw.markdown || '') || looksLikeJson(raw.summary || '')) {
      return {
        ...raw,
        summary: 'Conseil généré — voir le détail ci-dessous.',
        markdown: planToMarkdown(raw.plan) || raw.summary,
      }
    }
    return raw
  }

  try {
    const start = blob.indexOf('{')
    const end = blob.lastIndexOf('}')
    const data = JSON.parse(blob.slice(start, end + 1)) as Record<string, unknown>
    const planRaw = Array.isArray(data.plan) ? data.plan : []
    const plan = planRaw
      .map(normalizePlanItem)
      .filter((p): p is PlanItem => p != null)
      .slice(0, 10)
    let summary = String(data.summary ?? '').trim()
    let markdown = String(data.markdown ?? '').trim()
    if (!summary) summary = 'Conseil généré — voir le plan et l’analyse ci-dessous.'
    if (!markdown || looksLikeJson(markdown)) {
      markdown = [summary, planToMarkdown(plan)].filter(Boolean).join('\n\n')
    }
    return {
      ...raw,
      summary,
      plan: plan.length ? plan : raw.plan,
      markdown,
      answer: markdown,
      structured: true,
    }
  } catch {
    return {
      ...raw,
      summary: looksLikeJson(raw.summary)
        ? 'Le modèle a renvoyé un format difficile à lire — relancez l’analyse.'
        : raw.summary,
      markdown: looksLikeJson(raw.markdown || raw.answer || '')
        ? '_Réponse JSON illisible. Relancez l’analyse pour un rendu markdown._'
        : raw.markdown || raw.answer,
    }
  }
}

type StoredPlan = {
  status: string
  model: string | null
  summary: string | null
  plan: PlanItem[]
  markdown: string | null
  error: string | null
  updated_at: string | null
}

export function CoachPage() {
  const { types } = useSessionTypes()
  const [status, setStatus] = useState<CoachStatus | null>(null)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<AdviseResponse | null>(null)
  const [storedPlan, setStoredPlan] = useState<StoredPlan | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [busy, setBusy] = useState(false)
  const [planBusy, setPlanBusy] = useState(false)

  const display = useMemo(() => (answer ? normalizeAdvise(answer) : null), [answer])

  function labelFor(id: string | null): string {
    if (!id) return 'Séance'
    return types.find((t) => t.id === id)?.label_fr ?? id
  }

  function refreshStatus() {
    setLoadingStatus(true)
    return fetch('/api/coach/status')
      .then(async (res) => {
        if (!res.ok) throw new Error(`Statut coach HTTP ${res.status}`)
        return (await res.json()) as CoachStatus
      })
      .then((data) => setStatus(data))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Statut coach impossible')
      })
      .finally(() => setLoadingStatus(false))
  }

  function loadPlan() {
    return fetch('/api/coach/plan')
      .then(async (res) => {
        if (!res.ok) throw new Error(`Plan HTTP ${res.status}`)
        return (await res.json()) as StoredPlan
      })
      .then((data) => setStoredPlan(data))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Plan impossible')
      })
  }

  useEffect(() => {
    void refreshStatus()
    void loadPlan()
  }, [])

  async function refreshPlan() {
    setPlanBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/coach/plan/refresh', { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(typeof body.detail === 'string' ? body.detail : `Refresh HTTP ${res.status}`)
      }
      if (body.plan) setStoredPlan(body.plan as StoredPlan)
      else await loadPlan()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refresh plan impossible')
    } finally {
      setPlanBusy(false)
    }
  }

  async function runAdvise() {
    setBusy(true)
    setError(null)
    setAnswer(null)
    try {
      const res = await fetch('/api/coach/advise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: question.trim() || null,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(
          typeof body.detail === 'string' ? body.detail : `Coach HTTP ${res.status}`,
        )
      }
      setAnswer(normalizeAdvise(body as AdviseResponse))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analyse impossible')
    } finally {
      setBusy(false)
    }
  }

  const planItems = storedPlan?.plan ?? []

  return (
    <>
      <header className="page-hero">
        <h1>Coach IA</h1>
        <p>
          Plan calendrier généré automatiquement (sync / refresh). La question libre ne régénère
          plus le plan. Tout reste local via Ollama.
        </p>
      </header>

      {error && <p className="banner error">{error}</p>}

      <div className="coach-status-bar" aria-label="État du modèle">
        {loadingStatus && <span className="muted">Vérification Ollama…</span>}
        {status && (
          <>
            <span
              className="status-pill compact"
              title={status.reachable ? 'Ollama joignable' : 'Ollama injoignable'}
            >
              <span className={`status-dot ${status.reachable ? 'on' : ''}`} />
              Ollama
            </span>
            <span
              className="status-pill compact"
              title={status.model_installed ? 'Modèle installé' : 'Modèle non installé'}
            >
              <span className={`status-dot ${status.model_installed ? 'on' : ''}`} />
              {status.model}
            </span>
            <span
              className={`status-pill compact ${status.ready ? '' : 'is-warn'}`}
              title={status.ready ? 'Prêt' : 'Pas prêt'}
            >
              <span className={`status-dot ${status.ready ? 'on' : ''}`} />
              {status.ready ? 'Prêt' : 'Pas prêt'}
            </span>
          </>
        )}
        {status?.ready && (
          <p className="muted coach-status-hint">
            Modèle gardé en RAM (`keep_alive=-1`). 1er chargement CPU peut être long.
          </p>
        )}
      </div>

      <section className="panel-block coach-plan">
        <div className="section-head">
          <h3 style={{ margin: 0 }}>Plan calendrier</h3>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => void refreshPlan()}
            disabled={planBusy || status?.ready === false}
          >
            {planBusy ? 'Refresh…' : storedPlan?.status === 'running' ? 'En cours…' : 'Rafraîchir'}
          </button>
        </div>
        {storedPlan?.summary && <p className="coach-summary-text">{storedPlan.summary}</p>}
        {storedPlan?.error && <p className="banner error">{storedPlan.error}</p>}
        {planItems.length === 0 ? (
          <p className="muted">
            Aucun plan encore. Sync Strava (nouvelles sorties) ou cliquez Rafraîchir.
          </p>
        ) : (
          <div className="coach-plan-grid">
            {planItems.map((item, idx) => (
              <article key={`${item.date ?? 'x'}-${idx}`} className="coach-plan-card">
                <header>
                  <time>{formatPlanDate(item.date)}</time>
                  {item.session_type && (
                    <span className={`chip ${sessionToneClass(item.session_type)}`}>
                      {labelFor(item.session_type)}
                    </span>
                  )}
                </header>
                <strong>{item.title}</strong>
                {item.details && <p>{item.details}</p>}
                <footer>
                  {item.duration_or_distance && <span>{item.duration_or_distance}</span>}
                  {item.target_pace && <span>{item.target_pace}</span>}
                </footer>
              </article>
            ))}
          </div>
        )}
        {storedPlan?.updated_at && (
          <p className="muted" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
            Mis à jour : {new Date(storedPlan.updated_at).toLocaleString('fr-FR')}
            {storedPlan.model ? ` · ${storedPlan.model}` : ''}
          </p>
        )}
      </section>

      <section className="panel-block">
        <h3>Question libre (optionnel)</h3>
        <textarea
          className="coach-question"
          rows={3}
          placeholder="Ex. Comment interpréter ma charge des 28 derniers jours ?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={busy}
        />
        <div className="admin-actions" style={{ marginTop: '0.85rem' }}>
          <button
            type="button"
            className="btn"
            onClick={() => void runAdvise()}
            disabled={busy || status?.ready === false}
          >
            {busy ? 'Analyse en cours…' : 'Lancer l’analyse'}
          </button>
        </div>
      </section>

      {display && (
        <>
          <section className="panel-block coach-summary">
            <h3>Synthèse · {display.model}</h3>
            <p className="muted">
              Contexte : {display.context_summary.recent_activities ?? 0} sorties · confiance
              prévisions {display.context_summary.confidence ?? '—'} ·{' '}
              {display.context_summary.analytics_category ?? '—'}
            </p>
            <p className="coach-summary-text">{display.summary}</p>
          </section>
          <section className="panel-block coach-answer">
            <h3>Analyse détaillée</h3>
            <div className="coach-markdown">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {display.markdown || display.answer}
              </ReactMarkdown>
            </div>
          </section>
        </>
      )}
    </>
  )
}

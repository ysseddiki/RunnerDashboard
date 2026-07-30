import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
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

export function CoachPage() {
  const { types } = useSessionTypes()
  const [status, setStatus] = useState<CoachStatus | null>(null)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<AdviseResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [busy, setBusy] = useState(false)

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

  useEffect(() => {
    void refreshStatus()
  }, [])

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

  return (
    <>
      <header className="page-hero">
        <h1>Coach IA</h1>
        <p>
          Analyse locale via Ollama : synthèse, plan de séances, puis détail markdown. Aucune donnée
          n’est envoyée vers un cloud IA.
        </p>
      </header>

      {error && <p className="banner error">{error}</p>}

      <section className="panel-block">
        <h3>État du modèle</h3>
        {loadingStatus && <p className="muted">Vérification Ollama…</p>}
        {status && (
          <dl className="kv">
            <div>
              <dt>Ollama</dt>
              <dd>{status.reachable ? 'Joignable' : 'Injoignable'}</dd>
            </div>
            <div>
              <dt>Modèle</dt>
              <dd>{status.model}</dd>
            </div>
            <div>
              <dt>Installé</dt>
              <dd>{status.model_installed ? 'Oui' : 'Non — téléchargez-le dans Admin'}</dd>
            </div>
            <div>
              <dt>Prêt</dt>
              <dd>{status.ready ? 'Oui' : 'Non'}</dd>
            </div>
            <div>
              <dt>Timeout chat</dt>
              <dd>
                {status.chat_timeout_s != null ? `${Math.round(status.chat_timeout_s)} s` : '—'}
              </dd>
            </div>
          </dl>
        )}
        {!status?.ready && (
          <p className="muted">
            Procédure : Admin → choisir 7B/14B → « Télécharger le modèle », ou voir{' '}
            <Link to="/docs" className="inline-link">
              Docs
            </Link>{' '}
            / README.
          </p>
        )}
        {status?.ready && (
          <p className="muted">
            Sur CPU, le 1er appel charge le modèle (peut prendre plusieurs minutes). Si timeout :
            réessayez, ou passez au profil 7B dans Admin.
          </p>
        )}
      </section>

      <section className="panel-block">
        <h3>Question (optionnel)</h3>
        <textarea
          className="coach-question"
          rows={3}
          placeholder="Ex. Propose un plan sur 10 jours cohérent avec mon allure 10 km estimée."
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
            {busy
              ? 'Analyse en cours (1er appel CPU : jusqu’à plusieurs minutes)…'
              : 'Lancer l’analyse'}
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

          {display.plan.length > 0 && (
            <section className="panel-block coach-plan">
              <h3>Plan calendrier</h3>
              <div className="coach-plan-grid">
                {display.plan.map((item, idx) => (
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
            </section>
          )}

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

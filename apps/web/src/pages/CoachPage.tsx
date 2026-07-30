import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

type CoachStatus = {
  reachable: boolean
  model: string
  model_installed: boolean
  ready: boolean
  error: string | null
  installed_models: string[]
}

type AdviseResponse = {
  model: string
  answer: string
  context_summary: {
    predictions_available?: boolean
    confidence?: string
    analytics_category?: string
    recent_activities?: number
  }
}

export function CoachPage() {
  const [status, setStatus] = useState<CoachStatus | null>(null)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<AdviseResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [busy, setBusy] = useState(false)

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
      setAnswer(body as AdviseResponse)
      await refreshStatus()
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
          Analyse locale via Ollama : corrélation des prévisions d’allure avec vos sorties (FC,
          types de séance, min/km, volume, météo). Aucune donnée n’est envoyée vers un cloud IA.
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
      </section>

      <section className="panel-block">
        <h3>Question (optionnel)</h3>
        <textarea
          className="coach-question"
          rows={3}
          placeholder="Ex. Est-ce que mon allure 10 km estimée est cohérente avec mes seuils et ma FC récente ?"
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
            {busy ? 'Analyse en cours (peut prendre 1–2 min)…' : 'Lancer l’analyse'}
          </button>
        </div>
      </section>

      {answer && (
        <section className="panel-block coach-answer">
          <h3>Conseil · {answer.model}</h3>
          <p className="muted">
            Contexte :{' '}
            {answer.context_summary.recent_activities ?? 0} sorties · confiance prévisions{' '}
            {answer.context_summary.confidence ?? '—'} ·{' '}
            {answer.context_summary.analytics_category ?? '—'}
          </p>
          <pre className="coach-answer-text">{answer.answer}</pre>
        </section>
      )}
    </>
  )
}

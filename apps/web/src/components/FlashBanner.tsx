import { useEffect } from 'react'

type Props = {
  tone: 'error' | 'ok' | 'warn'
  message: string | null
  onDismiss: () => void
  /** Auto-dismiss success after ms (default 5s). Errors stay until dismiss. */
  autoDismissMs?: number
}

export function FlashBanner({ tone, message, onDismiss, autoDismissMs = 5000 }: Props) {
  useEffect(() => {
    if (!message || tone === 'error') return
    const t = window.setTimeout(onDismiss, autoDismissMs)
    return () => window.clearTimeout(t)
  }, [message, tone, autoDismissMs, onDismiss])

  if (!message) return null

  return (
    <p className={`banner ${tone} banner-flash`} role="status" aria-live="polite">
      <span>{message}</span>
      <button type="button" className="banner-dismiss" onClick={onDismiss} aria-label="Fermer">
        ×
      </button>
    </p>
  )
}

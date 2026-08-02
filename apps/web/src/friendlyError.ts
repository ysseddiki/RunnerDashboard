/** Messages d’erreur actionnables (sans codes HTTP bruts). */
export function friendlyError(err: unknown, fallback = 'Une erreur est survenue.'): string {
  const raw = err instanceof Error ? err.message : typeof err === 'string' ? err : ''
  if (!raw) return fallback
  const lower = raw.toLowerCase()
  if (lower.includes('failed to fetch') || lower.includes('network')) {
    return 'Connexion impossible. Vérifiez le réseau puis réessayez.'
  }
  if (/http\s*401|non autorisé|unauthorized/i.test(raw)) {
    return 'Session expirée. Reconnectez-vous.'
  }
  if (/http\s*403|interdit|forbidden/i.test(raw)) {
    return 'Action non autorisée.'
  }
  if (/http\s*404|introuvable|not found/i.test(raw)) {
    return 'Ressource introuvable.'
  }
  if (/http\s*429|trop de requêtes|rate/i.test(raw)) {
    return 'Trop de requêtes. Patientez un instant puis réessayez.'
  }
  if (/http\s*5\d\d|révision données|activités http|analytics http|status strava|prévisions http|projection http|sync http|bulk http|comparaison http/i.test(raw)) {
    return 'Le serveur ne répond pas correctement. Réessayez dans un moment.'
  }
  if (/^https?:|http\s*\d{3}/i.test(raw) || /HTTP\s*\d{3}/.test(raw)) {
    return fallback
  }
  return raw
}

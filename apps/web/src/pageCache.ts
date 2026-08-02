import { apiFetch } from './auth'
import { clearPredictionsCache } from './predictionsCache'

export const HOME_CACHE_KEY = 'rd-home-cache-v1'
export const ACTIVITIES_CACHE_KEY = 'rd-activities-cache-v1'

type CacheEnvelope<T> = {
  revision: string
  data: T
  savedAt: string
}

export async function fetchDataRevision(): Promise<string> {
  const res = await apiFetch('/api/analytics/data-revision')
  if (!res.ok) throw new Error(`Révision données HTTP ${res.status}`)
  const body = (await res.json()) as { revision: string }
  return body.revision
}

export function peekPageCache<T>(key: string): CacheEnvelope<T> | null {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CacheEnvelope<T>
    if (!parsed?.revision || parsed.data == null) return null
    return parsed
  } catch {
    return null
  }
}

export function readPageCache<T>(key: string, revision: string): T | null {
  const peeked = peekPageCache<T>(key)
  if (!peeked || peeked.revision !== revision) return null
  return peeked.data
}

export function writePageCache<T>(key: string, revision: string, data: T) {
  try {
    const payload: CacheEnvelope<T> = {
      revision,
      data,
      savedAt: new Date().toISOString(),
    }
    sessionStorage.setItem(key, JSON.stringify(payload))
  } catch {
    /* quota / private mode */
  }
}

export function clearPageCache(key: string) {
  try {
    sessionStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

/** Invalide accueil, activités et prévisions (après Sync Strava). */
export function clearAllPageCaches() {
  clearPageCache(HOME_CACHE_KEY)
  clearPageCache(ACTIVITIES_CACHE_KEY)
  clearPredictionsCache()
}

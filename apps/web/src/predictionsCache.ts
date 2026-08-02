import type { PredictionsOverview } from './types'

const STORAGE_KEY = 'rd-predictions-cache-v1'

type ProjectionOverview = {
  available: boolean
  volume: Array<{ week: string; distance_km?: number; kind: string }>
  pace_10k: Array<{ week: string; pace_sec_per_km?: number; kind: string }>
  notes_fr: string[]
}

export type PredictionsCachePayload = {
  revision: string
  predictions: PredictionsOverview
  projections: ProjectionOverview
  savedAt: string
}

export function readPredictionsCache(revision: string): PredictionsCachePayload | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PredictionsCachePayload
    if (!parsed?.revision || parsed.revision !== revision) return null
    if (!parsed.predictions || !parsed.projections) return null
    return parsed
  } catch {
    return null
  }
}

export function writePredictionsCache(payload: PredictionsCachePayload) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    /* quota / private mode */
  }
}

export function clearPredictionsCache() {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

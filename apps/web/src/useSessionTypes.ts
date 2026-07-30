import { useEffect, useState } from 'react'
import type { SessionTypeInfo } from './types'
import { apiFetch } from './auth'

let cachedTypes: SessionTypeInfo[] | null = null
let pendingFetch: Promise<SessionTypeInfo[]> | null = null

function loadSessionTypes(): Promise<SessionTypeInfo[]> {
  if (cachedTypes) return Promise.resolve(cachedTypes)
  if (!pendingFetch) {
    pendingFetch = apiFetch('/api/activities/session-types')
      .then(async (res) => {
        if (!res.ok) throw new Error(`Types HTTP ${res.status}`)
        return (await res.json()) as SessionTypeInfo[]
      })
      .then((data) => {
        cachedTypes = data
        return data
      })
      .finally(() => {
        pendingFetch = null
      })
  }
  return pendingFetch
}

export function useSessionTypes() {
  const [types, setTypes] = useState<SessionTypeInfo[]>(cachedTypes ?? [])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void loadSessionTypes()
      .then((data) => {
        if (!cancelled) setTypes(data)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Catalogue types indisponible')
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { types, error }
}

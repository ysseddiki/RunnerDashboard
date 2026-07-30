import { useEffect, useState } from 'react'
import type { TerrainInfo } from './types'
import { apiFetch } from './auth'

let cached: TerrainInfo[] | null = null
let pending: Promise<TerrainInfo[]> | null = null

function loadTerrains(): Promise<TerrainInfo[]> {
  if (cached) return Promise.resolve(cached)
  if (!pending) {
    pending = apiFetch('/api/activities/terrains')
      .then(async (res) => {
        if (!res.ok) throw new Error(`Terrains HTTP ${res.status}`)
        return (await res.json()) as TerrainInfo[]
      })
      .then((data) => {
        cached = data
        return data
      })
      .finally(() => {
        pending = null
      })
  }
  return pending
}

export function useTerrains() {
  const [terrains, setTerrains] = useState<TerrainInfo[]>(cached ?? [])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void loadTerrains()
      .then((data) => {
        if (!cancelled) setTerrains(data)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Catalogue terrains indisponible')
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { terrains, error }
}

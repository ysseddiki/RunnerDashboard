import type { ActivityFeatures, StreamPoint } from './types'
import { formatPaceSec } from './format'

export type ChartSeriesKey = 'pace' | 'heartrate' | 'cadence' | 'altitude' | 'watts'

export type ChartAttention = {
  id: string
  kind: 'pace_fade' | 'slow_km' | 'hr_high' | 'decoupling' | 'cadence_drop'
  title: string
  detail: string
  /** Distance (km) for chart marker; null = whole-session note */
  distance_km: number | null
  series: ChartSeriesKey
  severity: 'info' | 'warn'
}

const EASY_TYPES = new Set([
  'ef',
  'endurance_fondamentale',
  'endurance_active',
  'recup',
  'footing',
  'sortie_longue',
])

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? ((sorted[mid - 1]! + sorted[mid]!) / 2)
    : sorted[mid]!
}

/** Heuristics côté UI à partir des streams + features (pas de recalcul serveur). */
export function buildChartAttentions(opts: {
  points: StreamPoint[]
  features?: ActivityFeatures | null
  sessionType?: string | null
}): ChartAttention[] {
  const { points, features, sessionType } = opts
  const out: ChartAttention[] = []
  const totalKm = points.length > 0 ? points[points.length - 1]!.distance_km : 0

  const decoupling = features?.decoupling_pct ?? features?.session?.decoupling_pct
  if (decoupling != null && decoupling >= 5) {
    out.push({
      id: 'decoupling',
      kind: 'decoupling',
      title: 'Dérive cardiaque',
      detail: `La FC monte plus vite que l’allure (+${decoupling.toFixed(1)} %). Souvent fatigue, chaleur ou allure un peu haute pour la zone.`,
      distance_km: totalKm > 0 ? totalKm * 0.55 : null,
      series: 'heartrate',
      severity: decoupling >= 8 ? 'warn' : 'info',
    })
  }

  const splitDelta = features?.session?.split_delta_sec_per_km
  if (splitDelta != null && splitDelta >= 8) {
    out.push({
      id: 'pace_fade',
      kind: 'pace_fade',
      title: 'Perte de rythme (2e moitié)',
      detail: `Allure ~${splitDelta.toFixed(0)} s/km plus lente en seconde moitié. Possible départ trop rapide, heat, ou fatigue.`,
      distance_km: totalKm > 0 ? totalKm * 0.5 : null,
      series: 'pace',
      severity: splitDelta >= 15 ? 'warn' : 'info',
    })
  }

  const splits = features?.splits_km?.filter((s) => s.pace_sec_per_km != null) ?? []
  if (splits.length >= 4) {
    const paces = splits.map((s) => s.pace_sec_per_km!)
    const med = median(paces)
    if (med != null) {
      const slowest = splits.reduce((best, s) =>
        (s.pace_sec_per_km ?? 0) > (best.pace_sec_per_km ?? 0) ? s : best,
      )
      const delta = (slowest.pace_sec_per_km ?? 0) - med
      if (delta >= 20 && slowest.km > 1) {
        out.push({
          id: `slow_km_${slowest.km}`,
          kind: 'slow_km',
          title: `Km ${slowest.km} plus lent`,
          detail: `Allure ${formatPaceSec(slowest.pace_sec_per_km)} vs médiane ${formatPaceSec(med)} (+${Math.round(delta)} s/km). Relief, feu rouge, ou vrai coup de moins bien.`,
          distance_km: Math.max(0.1, slowest.km - 0.5),
          series: 'pace',
          severity: delta >= 35 ? 'warn' : 'info',
        })
      }
    }
  }

  const pctAbove = features?.session?.pct_above_z2
  const isEasy = sessionType != null && EASY_TYPES.has(sessionType)
  if (isEasy && pctAbove != null && pctAbove >= 25) {
    out.push({
      id: 'hr_high_easy',
      kind: 'hr_high',
      title: 'FC haute pour ce type',
      detail: `${pctAbove.toFixed(0)} % du temps hors Z1–Z2 alors que la séance est classée endurance / récup. Soit l’allure était trop haute, soit le type est à revoir.`,
      distance_km: totalKm > 0 ? totalKm * 0.4 : null,
      series: 'heartrate',
      severity: pctAbove >= 40 ? 'warn' : 'info',
    })
  }

  // Cadence drop: compare first vs last third of samples with cadence
  const withCad = points.filter((p) => p.cadence_ppm != null && p.cadence_ppm > 0)
  if (withCad.length >= 30) {
    const third = Math.floor(withCad.length / 3)
    const first = withCad.slice(0, third)
    const last = withCad.slice(-third)
    const avg = (arr: StreamPoint[]) =>
      arr.reduce((s, p) => s + (p.cadence_ppm ?? 0), 0) / arr.length
    const a0 = avg(first)
    const a1 = avg(last)
    if (a0 >= 150 && a1 > 0 && a0 - a1 >= 8) {
      const mid = last[Math.floor(last.length / 2)]
      out.push({
        id: 'cadence_drop',
        kind: 'cadence_drop',
        title: 'Cadence en baisse',
        detail: `Cadence moyenne ${Math.round(a0)} → ${Math.round(a1)} PPM en fin de sortie. Fatigue musculaire ou allure qui s’effondre.`,
        distance_km: mid?.distance_km ?? (totalKm > 0 ? totalKm * 0.75 : null),
        series: 'cadence',
        severity: a0 - a1 >= 12 ? 'warn' : 'info',
      })
    }
  }

  // Cap to avoid clutter
  return out.slice(0, 5)
}

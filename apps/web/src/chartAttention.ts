import type { ActivityFeatures, StreamPoint } from './types'
import { formatPaceSec } from './format'

export type ChartSeriesKey = 'pace' | 'heartrate' | 'cadence' | 'altitude' | 'watts'

export type ChartAttention = {
  id: string
  kind: 'pace_fade' | 'slow_km' | 'hr_high' | 'decoupling' | 'cadence_drop'
  title: string
  detail: string
  /** Midpoint for marker; null = no point */
  distance_km: number | null
  /** Highlighted range on the chart (km) */
  from_km: number | null
  to_km: number | null
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
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!
}

function rangeMid(from: number, to: number): number {
  return (from + to) / 2
}

/** Longest contiguous stretch where predicate holds; returns km bounds. */
function longestStretch(
  points: StreamPoint[],
  pred: (p: StreamPoint) => boolean,
): { from: number; to: number } | null {
  let bestFrom = 0
  let bestTo = 0
  let bestLen = 0
  let start: StreamPoint | null = null
  let prev: StreamPoint | null = null

  const flush = () => {
    if (!start || !prev) return
    const len = prev.distance_km - start.distance_km
    if (len < 0.4) return
    if (len > bestLen) {
      bestLen = len
      bestFrom = start.distance_km
      bestTo = prev.distance_km
    }
  }

  for (const p of points) {
    if (pred(p)) {
      if (!start) start = p
      prev = p
    } else {
      flush()
      start = null
      prev = null
    }
  }
  flush()
  return bestLen > 0 ? { from: bestFrom, to: bestTo } : null
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
  if (totalKm <= 0) return out

  const decoupling = features?.decoupling_pct ?? features?.session?.decoupling_pct
  if (decoupling != null && decoupling >= 5) {
    const from = totalKm * 0.45
    const to = totalKm
    out.push({
      id: 'decoupling',
      kind: 'decoupling',
      title: 'Dérive cardiaque',
      detail: `La FC monte plus vite que l’allure (+${decoupling.toFixed(1)} %). Souvent fatigue, chaleur ou allure un peu haute pour la zone.`,
      distance_km: rangeMid(from, to),
      from_km: from,
      to_km: to,
      series: 'heartrate',
      severity: decoupling >= 8 ? 'warn' : 'info',
    })
  }

  const splitDelta = features?.session?.split_delta_sec_per_km
  if (splitDelta != null && splitDelta >= 8) {
    const from = totalKm * 0.5
    const to = totalKm
    out.push({
      id: 'pace_fade',
      kind: 'pace_fade',
      title: 'Perte de rythme (2e moitié)',
      detail: `Allure ~${splitDelta.toFixed(0)} s/km plus lente en seconde moitié. Possible départ trop rapide, heat, ou fatigue.`,
      distance_km: rangeMid(from, to),
      from_km: from,
      to_km: to,
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
        const from = Math.max(0, slowest.km - 1)
        const to = slowest.km
        out.push({
          id: `slow_km_${slowest.km}`,
          kind: 'slow_km',
          title: `Km ${slowest.km} plus lent`,
          detail: `Allure ${formatPaceSec(slowest.pace_sec_per_km)} vs médiane ${formatPaceSec(med)} (+${Math.round(delta)} s/km). Relief, feu rouge, ou vrai coup de moins bien.`,
          distance_km: rangeMid(from, to),
          from_km: from,
          to_km: to,
          series: 'pace',
          severity: delta >= 35 ? 'warn' : 'info',
        })
      }
    }
  }

  const pctAbove = features?.session?.pct_above_z2
  const isEasy = sessionType != null && EASY_TYPES.has(sessionType)
  if (isEasy && pctAbove != null && pctAbove >= 25) {
    const hrs = points.map((p) => p.heartrate).filter((v): v is number => v != null && v > 0)
    const medHr = median(hrs)
    const stretch =
      medHr != null
        ? longestStretch(points, (p) => (p.heartrate ?? 0) >= medHr * 1.06)
        : null
    const from = stretch?.from ?? totalKm * 0.25
    const to = stretch?.to ?? totalKm * 0.85
    out.push({
      id: 'hr_high_easy',
      kind: 'hr_high',
      title: 'FC haute pour ce type',
      detail: `${pctAbove.toFixed(0)} % du temps hors Z1–Z2 alors que la séance est classée endurance / récup. Soit l’allure était trop haute, soit le type est à revoir.`,
      distance_km: rangeMid(from, to),
      from_km: from,
      to_km: to,
      series: 'heartrate',
      severity: pctAbove >= 40 ? 'warn' : 'info',
    })
  }

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
      const from = last[0]!.distance_km
      const to = last[last.length - 1]!.distance_km
      out.push({
        id: 'cadence_drop',
        kind: 'cadence_drop',
        title: 'Cadence en baisse',
        detail: `Cadence moyenne ${Math.round(a0)} → ${Math.round(a1)} PPM en fin de sortie. Fatigue musculaire ou allure qui s’effondre.`,
        distance_km: rangeMid(from, to),
        from_km: from,
        to_km: to,
        series: 'cadence',
        severity: a0 - a1 >= 12 ? 'warn' : 'info',
      })
    }
  }

  return out.slice(0, 5)
}

export function attentionRangeLabel(a: ChartAttention): string | null {
  if (a.from_km == null || a.to_km == null) return null
  return `${a.from_km.toFixed(1)}–${a.to_km.toFixed(1)} km`
}

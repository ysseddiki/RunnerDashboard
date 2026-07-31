import { useMemo, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import type { ActivityFeatures, StreamPoint } from '../types'
import { downsamplePoints } from '../streams'
import { formatClock, formatPaceSec } from '../format'
import { buildChartAttentions, attentionRangeLabel, type ChartAttention, type ChartSeriesKey } from '../chartAttention'

type SeriesKey = ChartSeriesKey

const SERIES_META: Record<
  SeriesKey,
  { label: string; unit: string; color: string; invertY?: boolean }
> = {
  pace: { label: 'Allure', unit: '/km', color: '#1a5c3a', invertY: true },
  heartrate: { label: 'FC', unit: 'bpm', color: '#a32d2d' },
  cadence: { label: 'Cadence', unit: 'PPM', color: '#2d6a8f' },
  altitude: { label: 'Altitude', unit: 'm', color: '#5c6f62' },
  watts: { label: 'Puissance', unit: 'W', color: '#8a5a12' },
}

function valueAt(point: StreamPoint, key: SeriesKey): number | null {
  switch (key) {
    case 'pace':
      return point.pace_sec_per_km
    case 'heartrate':
      return point.heartrate
    case 'cadence':
      return point.cadence_ppm
    case 'altitude':
      return point.altitude_m
    case 'watts':
      return point.watts
  }
}

function formatValue(key: SeriesKey, value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—'
  if (key === 'pace') return formatPaceSec(value)
  if (key === 'altitude') return `${value.toFixed(0)} m`
  if (key === 'heartrate' || key === 'cadence' || key === 'watts') {
    return `${Math.round(value)} ${SERIES_META[key].unit}`
  }
  return String(value)
}

function nearestIndex(sampled: StreamPoint[], distanceKm: number): number {
  let best = 0
  let bestDist = Infinity
  for (let i = 0; i < sampled.length; i++) {
    const d = Math.abs(sampled[i]!.distance_km - distanceKm)
    if (d < bestDist) {
      bestDist = d
      best = i
    }
  }
  return best
}

function snapX(sampled: StreamPoint[], xData: number[], distanceKm: number): string {
  const idx = nearestIndex(sampled, distanceKm)
  return String(xData[idx])
}

function bandColor(severity: 'info' | 'warn', active: boolean): string {
  if (severity === 'warn') {
    return active ? 'rgba(163, 45, 45, 0.28)' : 'rgba(163, 45, 45, 0.14)'
  }
  return active ? 'rgba(138, 90, 18, 0.26)' : 'rgba(138, 90, 18, 0.12)'
}

type Props = {
  points: StreamPoint[]
  features?: ActivityFeatures | null
  sessionType?: string | null
}

export function StreamCharts({ points, features, sessionType }: Props) {
  const sampled = useMemo(() => downsamplePoints(points), [points])
  const attentions = useMemo(
    () => buildChartAttentions({ points: sampled, features, sessionType }),
    [sampled, features, sessionType],
  )
  const [activeId, setActiveId] = useState<string | null>(null)
  const active = attentions.find((a) => a.id === activeId) ?? null

  const available = useMemo(() => {
    const keys: SeriesKey[] = []
    for (const key of Object.keys(SERIES_META) as SeriesKey[]) {
      if (sampled.some((p) => valueAt(p, key) != null)) keys.push(key)
    }
    return keys
  }, [sampled])

  const option = useMemo((): EChartsOption | null => {
    if (sampled.length < 2 || available.length === 0) return null

    const xData = sampled.map((p) => Number(p.distance_km.toFixed(3)))
    const gridHeight = 92
    const gap = 56
    const topPad = 36
    const grids = available.map((_, i) => ({
      left: 56,
      right: 24,
      top: topPad + i * (gridHeight + gap),
      height: gridHeight,
    }))

    const xAxes = available.map((_, i) => ({
      type: 'category' as const,
      gridIndex: i,
      data: xData,
      boundaryGap: false,
      axisLabel: {
        show: i === available.length - 1,
        formatter: (v: string) => `${v} km`,
      },
      axisTick: { show: i === available.length - 1 },
      splitLine: { show: false },
    }))

    const yAxes = available.map((key, i) => ({
      type: 'value' as const,
      gridIndex: i,
      name: SERIES_META[key].label,
      nameLocation: 'end' as const,
      nameGap: 12,
      nameTextStyle: {
        color: SERIES_META[key].color,
        fontSize: 12,
        fontWeight: 600,
        padding: [0, 0, 4, 0],
      },
      inverse: Boolean(SERIES_META[key].invertY),
      scale: true,
      axisLabel: {
        formatter: (v: number) =>
          key === 'pace' ? formatPaceSec(v).replace(' /km', '') : String(Math.round(v)),
      },
      splitLine: { lineStyle: { color: 'rgba(20,32,24,0.08)' } },
    }))

    const segments = features?.chart_overlays?.interval_segments ?? []
    type MarkAreaPair = [
      { xAxis: string; itemStyle?: { color: string }; name?: string },
      { xAxis: string },
    ]
    const intervalAreas: MarkAreaPair[] =
      segments.length > 0
        ? segments.map(
            (seg): MarkAreaPair => [
              {
                xAxis: snapX(sampled, xData, seg.start_distance_m / 1000),
                itemStyle: { color: 'rgba(26, 92, 58, 0.12)' },
                name: 'Intervalle',
              },
              {
                xAxis: snapX(sampled, xData, seg.end_distance_m / 1000),
              },
            ],
          )
        : []

    const attentionsBySeries = new Map<SeriesKey, ChartAttention[]>()
    for (const a of attentions) {
      if (!available.includes(a.series)) continue
      if (a.from_km == null && a.to_km == null && a.distance_km == null) continue
      const list = attentionsBySeries.get(a.series) ?? []
      list.push(a)
      attentionsBySeries.set(a.series, list)
    }

    const series: EChartsOption['series'] = available.map((key, i) => {
      const marks = attentionsBySeries.get(key) ?? []
      const attentionAreas: MarkAreaPair[] = marks.flatMap((a) => {
        if (a.from_km == null || a.to_km == null || a.to_km <= a.from_km) return []
        const isActive = activeId === a.id
        return [
          [
            {
              xAxis: snapX(sampled, xData, a.from_km),
              itemStyle: { color: bandColor(a.severity, isActive) },
              name: a.title,
            },
            {
              xAxis: snapX(sampled, xData, a.to_km),
            },
          ] satisfies MarkAreaPair,
        ]
      })

      const markPointData = marks.flatMap((a) => {
        const mid = a.distance_km ?? (a.from_km != null && a.to_km != null
          ? (a.from_km + a.to_km) / 2
          : null)
        if (mid == null) return []
        const idx = nearestIndex(sampled, mid)
        const y = valueAt(sampled[idx]!, key)
        if (y == null || !Number.isFinite(y)) return []
        const isActive = activeId === a.id
        const coord: [string, number] = [String(xData[idx]), y]
        return [
          {
            name: a.title,
            coord,
            value: a.title,
            itemStyle: {
              color: a.severity === 'warn' ? '#a32d2d' : '#8a5a12',
              borderColor: '#fff',
              borderWidth: 2,
            },
            symbolSize: isActive ? 14 : 9,
            label: {
              show: isActive,
              formatter: a.title,
              position: 'top' as const,
              color: '#142018',
              fontSize: 11,
              fontWeight: 600 as const,
            },
          },
        ]
      })

      const allAreas = [
        ...(key === 'pace' ? intervalAreas : []),
        ...attentionAreas,
      ]

      return {
        name: SERIES_META[key].label,
        type: 'line' as const,
        showSymbol: false,
        sampling: 'lttb' as const,
        xAxisIndex: i,
        yAxisIndex: i,
        data: sampled.map((p) => {
          const v = valueAt(p, key)
          return v != null && Number.isFinite(v) ? Number(v.toFixed(2)) : null
        }),
        lineStyle: { width: 2, color: SERIES_META[key].color },
        itemStyle: { color: SERIES_META[key].color },
        connectNulls: true,
        ...(allAreas.length > 0
          ? { markArea: { silent: true, data: allAreas } }
          : {}),
        ...(markPointData.length > 0
          ? {
              markPoint: {
                symbol: 'circle' as const,
                data: markPointData,
              },
            }
          : {}),
      }
    })

    return {
      animation: false,
      color: available.map((k) => SERIES_META[k].color),
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross', link: [{ xAxisIndex: 'all' }] },
        formatter: (params) => {
          const list = Array.isArray(params) ? params : [params]
          const idx = list[0]?.dataIndex
          if (typeof idx !== 'number') return ''
          const point = sampled[idx]
          if (!point) return ''
          const near = attentions.filter((a) => {
            if (a.from_km != null && a.to_km != null) {
              return point.distance_km >= a.from_km && point.distance_km <= a.to_km
            }
            return a.distance_km != null && Math.abs(a.distance_km - point.distance_km) < 0.35
          })
          const rows = [
            `<div><strong>${point.distance_km.toFixed(2)} km</strong> · ${formatClock(point.time_s)}</div>`,
            ...available.map(
              (key) =>
                `<div style="color:${SERIES_META[key].color}">${SERIES_META[key].label}: <strong>${formatValue(key, valueAt(point, key))}</strong></div>`,
            ),
            ...near.map((a) => {
              const color = a.severity === 'warn' ? '#a32d2d' : '#8a5a12'
              return `<div style="margin-top:4px;color:${color}"><strong>${a.title}</strong> — ${a.detail}</div>`
            }),
          ]
          return rows.join('')
        },
      },
      axisPointer: { link: [{ xAxisIndex: 'all' }] },
      dataZoom: [
        {
          type: 'inside',
          xAxisIndex: available.map((_, i) => i),
          filterMode: 'none',
        },
        {
          type: 'slider',
          xAxisIndex: available.map((_, i) => i),
          height: 22,
          bottom: 8,
          borderColor: 'rgba(20,32,24,0.14)',
          fillerColor: 'rgba(26,92,58,0.15)',
          handleStyle: { color: '#1a5c3a' },
        },
      ],
      grid: grids,
      xAxis: xAxes,
      yAxis: yAxes,
      series,
    }
  }, [sampled, available, features, attentions, activeId])

  if (!option) {
    return <p className="muted">Aucune série numérique exploitable pour les courbes.</p>
  }

  const height = 36 + available.length * 148 + 44
  const hasIntervals = (features?.chart_overlays?.interval_segments?.length ?? 0) > 0

  return (
    <div className="charts-panel">
      {attentions.length > 0 && (
        <div className="chart-attentions" aria-label="Points d’attention">
          {attentions.map((a) => {
            const range = attentionRangeLabel(a)
            return (
              <button
                key={a.id}
                type="button"
                className={`chart-attention-chip${a.severity === 'warn' ? ' is-warn' : ''}${
                  activeId === a.id ? ' is-active' : ''
                }`}
                onClick={() => setActiveId((cur) => (cur === a.id ? null : a.id))}
                aria-pressed={activeId === a.id}
              >
                <span className="chart-attention-chip-title">{a.title}</span>
                {range && <span className="chart-attention-chip-km">{range}</span>}
              </button>
            )
          })}
        </div>
      )}
      {active && (
        <div className={`chart-attention-detail${active.severity === 'warn' ? ' is-warn' : ''}`}>
          <strong>{active.title}</strong>
          {attentionRangeLabel(active) && (
            <p className="chart-attention-range">{attentionRangeLabel(active)}</p>
          )}
          <p>{active.detail}</p>
        </div>
      )}
      <div className="charts-wrap">
        <p className="muted charts-hint">
          Survolez un point pour le détail · molette ou curseur pour zoomer.
          {hasIntervals ? ' · Bandes vertes = intervalles.' : ''}
          {attentions.length > 0
            ? ' · Bandes ambre/rouge = plages d’attention (cliquez une puce).'
            : ''}
        </p>
        <ReactECharts option={option} style={{ height, width: '100%' }} notMerge lazyUpdate />
      </div>
    </div>
  )
}

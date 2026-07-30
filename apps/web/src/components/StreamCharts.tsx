import { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import type { ActivityFeatures, StreamPoint } from '../types'
import { downsamplePoints } from '../streams'
import { formatClock, formatPaceSec } from '../format'

type SeriesKey = 'pace' | 'heartrate' | 'cadence' | 'altitude' | 'watts'

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

type Props = {
  points: StreamPoint[]
  features?: ActivityFeatures | null
}

export function StreamCharts({ points, features }: Props) {
  const sampled = useMemo(() => downsamplePoints(points), [points])

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
    const markAreas =
      segments.length > 0
        ? segments.map((seg) => [
            {
              xAxis: String(Number((seg.start_distance_m / 1000).toFixed(3))),
              itemStyle: { color: 'rgba(26, 92, 58, 0.12)' },
            },
            {
              xAxis: String(Number((seg.end_distance_m / 1000).toFixed(3))),
            },
          ])
        : undefined

    const series = available.map((key, i) => ({
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
      ...(key === 'pace' && markAreas
        ? { markArea: { silent: true, data: markAreas } }
        : {}),
    }))

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
          const rows = [
            `<div><strong>${point.distance_km.toFixed(2)} km</strong> · ${formatClock(point.time_s)}</div>`,
            ...available.map(
              (key) =>
                `<div style="color:${SERIES_META[key].color}">${SERIES_META[key].label}: <strong>${formatValue(key, valueAt(point, key))}</strong></div>`,
            ),
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
  }, [sampled, available, features])

  if (!option) {
    return <p className="muted">Aucune série numérique exploitable pour les graphs.</p>
  }

  const height = 36 + available.length * 148 + 44
  const hasIntervals = (features?.chart_overlays?.interval_segments?.length ?? 0) > 0
  const hasZones = Boolean(features?.chart_overlays?.zones_summary)

  return (
    <div className="charts-wrap">
      <p className="muted charts-hint">
        Survolez un point pour le détail · molette ou curseur bas pour zoomer / pan.
        {hasIntervals ? ' · Bandes vertes = intervalles détectés.' : ''}
        {hasZones ? ' · Zones FC résumées dans la lecture séance.' : ''}
      </p>
      <ReactECharts option={option} style={{ height, width: '100%' }} notMerge lazyUpdate />
    </div>
  )
}

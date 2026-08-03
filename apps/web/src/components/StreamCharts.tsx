import { useEffect, useMemo, useRef, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import type { ActivityFeatures, StreamPoint } from '../types'
import { downsamplePoints } from '../streams'
import { formatClock, formatPaceSec } from '../format'
import {
  buildChartAttentions,
  attentionRangeLabel,
  type ChartAttention,
  type ChartSeriesKey,
} from '../chartAttention'
import {
  CHART_BRAND,
  CHART_BRAND_FILL,
  CHART_DANGER,
  CHART_INK,
  CHART_LINE,
  CHART_OK_BAND,
  CHART_SERIES,
  CHART_WARN,
} from '../chartTheme'

type SeriesKey = ChartSeriesKey

const SERIES_ORDER: SeriesKey[] = ['heartrate', 'pace', 'cadence', 'altitude', 'watts']

const SERIES_META: Record<
  SeriesKey,
  { label: string; short: string; unit: string; color: string; invertY?: boolean }
> = {
  heartrate: { label: 'Fréquence cardiaque', short: 'FC', unit: 'bpm', color: CHART_SERIES.heartrate },
  pace: { label: 'Allure', short: 'Allure', unit: '/km', color: CHART_SERIES.pace, invertY: true },
  cadence: { label: 'Cadence', short: 'Cadence', unit: 'PPM', color: CHART_SERIES.cadence },
  altitude: { label: 'Altitude', short: 'Alt.', unit: 'm', color: CHART_SERIES.altitude },
  watts: { label: 'Puissance', short: 'W', unit: 'W', color: CHART_SERIES.watts },
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
  if (key === 'heartrate') return `${Math.round(value)} bpm`
  if (key === 'cadence') return `${Math.round(value)} PPM`
  if (key === 'watts') return `${Math.round(value)} W`
  return String(value)
}

function formatYTick(key: SeriesKey, v: number): string {
  if (key === 'pace') return formatPaceSec(v).replace(' /km', '')
  return String(Math.round(v))
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

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!
}

type ScrubState = {
  index: number
  distanceKm: number
  timeS: number
  values: Partial<Record<SeriesKey, number | null>>
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
  const [scrub, setScrub] = useState<ScrubState | null>(null)

  const available = useMemo(() => {
    return SERIES_ORDER.filter((key) => sampled.some((p) => valueAt(p, key) != null))
  }, [sampled])

  const avgPace = useMemo(() => {
    const vals = sampled
      .map((p) => p.pace_sec_per_km)
      .filter((v): v is number => v != null && Number.isFinite(v) && v > 0 && v < 1200)
    return median(vals)
  }, [sampled])

  const avgHr = useMemo(() => {
    const vals = sampled
      .map((p) => p.heartrate)
      .filter((v): v is number => v != null && Number.isFinite(v) && v > 40)
    return median(vals)
  }, [sampled])

  const option = useMemo((): EChartsOption | null => {
    if (sampled.length < 2 || available.length === 0) return null

    const xData = sampled.map((p) => Number(p.distance_km.toFixed(3)))
    const gridHeight = 148
    const gap = 64
    const topPad = 28
    const grids = available.map((_, i) => ({
      left: 58,
      right: 20,
      top: topPad + i * (gridHeight + gap),
      height: gridHeight,
      containLabel: false,
    }))

    const xAxes = available.map((_, i) => ({
      type: 'category' as const,
      gridIndex: i,
      data: xData,
      boundaryGap: false,
      axisLine: { lineStyle: { color: CHART_LINE } },
      axisLabel: {
        show: i === available.length - 1,
        color: '#5a6b7d',
        fontSize: 11,
        formatter: (v: string) => {
          const n = Number(v)
          if (!Number.isFinite(n)) return `${v} km`
          return Number.isInteger(n) || Math.abs(n * 2 - Math.round(n * 2)) < 1e-6
            ? `${n} km`
            : `${n.toFixed(1)} km`
        },
      },
      axisTick: { show: false },
      splitLine: {
        show: true,
        lineStyle: { color: CHART_LINE, type: 'solid' as const },
      },
    }))

    const yAxes = available.map((key, i) => ({
      type: 'value' as const,
      gridIndex: i,
      name: SERIES_META[key].label,
      nameLocation: 'end' as const,
      nameGap: 10,
      nameTextStyle: {
        color: SERIES_META[key].color,
        fontSize: 13,
        fontWeight: 650,
        align: 'left' as const,
        padding: [0, 0, 6, 0],
      },
      inverse: Boolean(SERIES_META[key].invertY),
      scale: true,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: '#5a6b7d',
        fontSize: 11,
        formatter: (v: number) => formatYTick(key, v),
      },
      splitLine: { lineStyle: { color: CHART_LINE } },
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
                itemStyle: { color: CHART_OK_BAND },
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
        const mid =
          a.distance_km ??
          (a.from_km != null && a.to_km != null ? (a.from_km + a.to_km) / 2 : null)
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
              color: a.severity === 'warn' ? CHART_DANGER : CHART_WARN,
              borderColor: '#fff',
              borderWidth: 2,
            },
            symbolSize: isActive ? 14 : 9,
            label: {
              show: isActive,
              formatter: a.title,
              position: 'top' as const,
              color: CHART_INK,
              fontSize: 11,
              fontWeight: 600 as const,
            },
          },
        ]
      })

      const allAreas = [...(key === 'pace' ? intervalAreas : []), ...attentionAreas]

      const refY =
        key === 'pace' ? avgPace : key === 'heartrate' ? avgHr : null
      const refLabel =
        key === 'pace' && avgPace != null
          ? `Moy. ${formatPaceSec(avgPace).replace(' /km', '')}`
          : key === 'heartrate' && avgHr != null
            ? `Moy. ${Math.round(avgHr)}`
            : null

      return {
        name: SERIES_META[key].label,
        type: 'line' as const,
        showSymbol: false,
        smooth: 0.25,
        sampling: 'lttb' as const,
        xAxisIndex: i,
        yAxisIndex: i,
        data: sampled.map((p) => {
          const v = valueAt(p, key)
          return v != null && Number.isFinite(v) ? Number(v.toFixed(2)) : null
        }),
        lineStyle: { width: 2.4, color: SERIES_META[key].color },
        itemStyle: { color: SERIES_META[key].color },
        connectNulls: true,
        ...(allAreas.length > 0 ? { markArea: { silent: true, data: allAreas } } : {}),
        ...(markPointData.length > 0
          ? {
              markPoint: {
                symbol: 'circle' as const,
                data: markPointData,
              },
            }
          : {}),
        ...(refY != null && refLabel
          ? {
              markLine: {
                silent: true,
                symbol: 'none' as const,
                animation: false,
                label: {
                  show: true,
                  formatter: refLabel,
                  position: 'insideEndTop' as const,
                  color: '#5a6b7d',
                  fontSize: 11,
                  fontWeight: 600 as const,
                  backgroundColor: 'rgba(255,255,255,0.85)',
                  padding: [2, 6],
                  borderRadius: 4,
                },
                lineStyle: {
                  type: 'dashed' as const,
                  width: 1.25,
                  color: 'rgba(90, 107, 125, 0.65)',
                },
                data: [{ yAxis: Number(refY.toFixed(2)) }],
              },
            }
          : {}),
      }
    })

    return {
      animation: false,
      color: available.map((k) => SERIES_META[k].color),
      tooltip: {
        show: false,
      },
      axisPointer: {
        link: [{ xAxisIndex: 'all' }],
        show: true,
        type: 'line',
        snap: true,
        triggerTooltip: false,
        triggerOn: 'mousemove|click',
        lineStyle: {
          color: 'rgba(15, 28, 46, 0.45)',
          width: 1.75,
          type: 'solid',
        },
        label: { show: false },
        handle: {
          show: true,
          size: 18,
          margin: 35,
          color: CHART_BRAND,
          shadowBlur: 0,
        },
      },
      dataZoom: [
        {
          type: 'inside',
          xAxisIndex: available.map((_, i) => i),
          filterMode: 'none',
          zoomOnMouseWheel: true,
          moveOnMouseMove: true,
        },
        {
          type: 'slider',
          xAxisIndex: available.map((_, i) => i),
          height: 18,
          bottom: 6,
          borderColor: CHART_LINE,
          fillerColor: CHART_BRAND_FILL,
          handleStyle: { color: CHART_BRAND },
          brushSelect: false,
          showDetail: false,
        },
      ],
      grid: grids,
      xAxis: xAxes,
      yAxis: yAxes,
      series,
    }
  }, [sampled, available, features, attentions, activeId, avgPace, avgHr])

  const chartRef = useRef<ReactECharts | null>(null)

  useEffect(() => {
    if (!active || active.from_km == null || active.to_km == null) return
    const instance = chartRef.current?.getEchartsInstance()
    if (!instance || sampled.length < 2) return
    const maxKm = sampled[sampled.length - 1]!.distance_km
    if (!(maxKm > 0)) return
    const pad = Math.max((active.to_km - active.from_km) * 0.35, 0.15)
    const start = Math.max(0, ((active.from_km - pad) / maxKm) * 100)
    const end = Math.min(100, ((active.to_km + pad) / maxKm) * 100)
    instance.dispatchAction({
      type: 'dataZoom',
      start,
      end,
    })
  }, [active, sampled])

  useEffect(() => {
    if (sampled.length === 0 || available.length === 0) {
      setScrub(null)
      return
    }
    const mid = Math.floor(sampled.length / 2)
    const point = sampled[mid]!
    setScrub({
      index: mid,
      distanceKm: point.distance_km,
      timeS: point.time_s,
      values: Object.fromEntries(available.map((k) => [k, valueAt(point, k)])) as ScrubState['values'],
    })
  }, [sampled, available])

  function onAxisPointer(event: unknown) {
    const ev = event as {
      axesInfo?: Array<{ value?: string | number }>
      dataIndexInside?: number
      dataIndex?: number
    }
    let idx: number | null = null
    if (typeof ev.dataIndexInside === 'number') idx = ev.dataIndexInside
    else if (typeof ev.dataIndex === 'number') idx = ev.dataIndex
    else if (ev.axesInfo?.[0]?.value != null) {
      const raw = Number(ev.axesInfo[0].value)
      if (Number.isFinite(raw)) idx = nearestIndex(sampled, raw)
    }
    if (idx == null || idx < 0 || idx >= sampled.length) return
    const point = sampled[idx]!
    setScrub({
      index: idx,
      distanceKm: point.distance_km,
      timeS: point.time_s,
      values: Object.fromEntries(available.map((k) => [k, valueAt(point, k)])) as ScrubState['values'],
    })
  }

  if (!option) {
    return <p className="muted">Aucune série numérique exploitable pour les courbes.</p>
  }

  const height = 28 + available.length * (148 + 64) + 36
  const hasIntervals = (features?.chart_overlays?.interval_segments?.length ?? 0) > 0
  const primaryKey = available[0]

  return (
    <div className="charts-panel charts-panel-irun">
      <div className="chart-scrub-hud" aria-live="polite">
        {scrub ? (
          <>
            <span className="chart-scrub-time">{formatClock(scrub.timeS)}</span>
            <span className="chart-scrub-sep" aria-hidden="true">
              ·
            </span>
            <span className="chart-scrub-km">{scrub.distanceKm.toFixed(2)} km</span>
            {primaryKey ? (
              <>
                <span className="chart-scrub-sep" aria-hidden="true">
                  ·
                </span>
                <span
                  className="chart-scrub-primary"
                  style={{ color: SERIES_META[primaryKey].color }}
                >
                  {formatValue(primaryKey, scrub.values[primaryKey] ?? null)}
                </span>
              </>
            ) : null}
            <div className="chart-scrub-series">
              {available.map((key) => (
                <span key={key} style={{ color: SERIES_META[key].color }}>
                  {SERIES_META[key].short}{' '}
                  <strong>{formatValue(key, scrub.values[key] ?? null)}</strong>
                </span>
              ))}
            </div>
          </>
        ) : (
          <span className="muted">Survolez ou glissez pour lire un point</span>
        )}
      </div>

      <div className="chart-legend" aria-label="Légende des plages">
        {hasIntervals && (
          <span className="chart-legend-item">
            <span className="chart-legend-swatch is-ok" aria-hidden="true" />
            Intervalles
          </span>
        )}
        {(avgPace != null || avgHr != null) && (
          <span className="chart-legend-item">
            <span className="chart-legend-swatch is-ref" aria-hidden="true" />
            Moyenne
          </span>
        )}
        <span className="chart-legend-item">
          <span className="chart-legend-swatch is-warn" aria-hidden="true" />
          Attention
        </span>
        <span className="chart-legend-item">
          <span className="chart-legend-swatch is-danger" aria-hidden="true" />
          Critique
        </span>
      </div>

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
        <ReactECharts
          ref={chartRef}
          option={option}
          style={{ height, width: '100%' }}
          notMerge
          lazyUpdate
          onEvents={{
            updateAxisPointer: onAxisPointer,
          }}
        />
      </div>
    </div>
  )
}

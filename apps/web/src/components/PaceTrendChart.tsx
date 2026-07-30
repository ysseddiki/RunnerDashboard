import { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import { formatPaceSec } from '../format'

type Point = { week: string; pace_sec_per_km: number }

type Props = {
  points: Point[]
}

function shortWeekLabel(isoWeek: string): string {
  const parts = isoWeek.split('-W')
  if (parts.length === 2) return `S${parts[1]}`
  return isoWeek.slice(-5)
}

export function PaceTrendChart({ points }: Props) {
  const option = useMemo((): EChartsOption | null => {
    if (points.length < 2) return null

    const labels = points.map((p) => shortWeekLabel(p.week))
    const values = points.map((p) => p.pace_sec_per_km)

    return {
      animation: false,
      grid: { left: 56, right: 20, top: 28, bottom: 36 },
      tooltip: {
        trigger: 'axis',
        formatter: (params) => {
          const list = Array.isArray(params) ? params : [params]
          const item = list[0]
          if (!item || typeof item.dataIndex !== 'number') return ''
          const point = points[item.dataIndex]
          if (!point) return ''
          return `<div><strong>${point.week}</strong></div><div style="color:#1a5c3a">Allure 10 km : <strong>${formatPaceSec(point.pace_sec_per_km)}</strong></div>`
        },
      },
      xAxis: {
        type: 'category',
        data: labels,
        boundaryGap: false,
        axisTick: { show: false },
        axisLine: { lineStyle: { color: 'rgba(20,32,24,0.14)' } },
        axisLabel: {
          color: '#5c6f62',
          fontSize: 11,
          fontFamily: 'Manrope, sans-serif',
        },
      },
      yAxis: {
        type: 'value',
        inverse: true,
        scale: true,
        name: 'Allure',
        nameTextStyle: {
          color: '#1a5c3a',
          fontSize: 12,
          fontWeight: 600,
          fontFamily: 'Manrope, sans-serif',
        },
        nameGap: 10,
        axisLabel: {
          color: '#5c6f62',
          fontSize: 11,
          fontFamily: 'Manrope, sans-serif',
          formatter: (v: number) => formatPaceSec(v).replace(' /km', ''),
        },
        splitLine: { lineStyle: { color: 'rgba(20,32,24,0.08)' } },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series: [
        {
          name: 'Allure 10 km',
          type: 'line',
          data: values.map((v) => Number(v.toFixed(1))),
          showSymbol: true,
          symbolSize: 7,
          smooth: 0.25,
          lineStyle: { width: 2.5, color: '#1a5c3a' },
          itemStyle: { color: '#1a5c3a', borderColor: '#fff', borderWidth: 2 },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(45, 122, 82, 0.28)' },
                { offset: 1, color: 'rgba(45, 122, 82, 0.02)' },
              ],
            },
          },
        },
      ],
    }
  }, [points])

  if (!option) {
    return <p className="muted">Pas assez d’historique pour tracer la tendance.</p>
  }

  const first = points[0]!
  const last = points[points.length - 1]!
  const faster = last.pace_sec_per_km < first.pace_sec_per_km
  const slower = last.pace_sec_per_km > first.pace_sec_per_km

  return (
    <div className="charts-wrap pred-trend-chart">
      <p className="muted charts-hint">
        Axe inversé : plus bas sur le graphique = allure plus rapide.
      </p>
      <ReactECharts option={option} style={{ height: 240, width: '100%' }} notMerge lazyUpdate />
      <p className="muted pred-trend-caption">
        {first.week} → {last.week} · {formatPaceSec(first.pace_sec_per_km)} →{' '}
        {formatPaceSec(last.pace_sec_per_km)}
        {faster ? ' (plus rapide)' : slower ? ' (plus lente)' : ''}
      </p>
    </div>
  )
}

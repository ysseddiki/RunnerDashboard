import { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import { formatPaceSec } from '../format'

type Point = {
  week: string
  distance_km?: number
  pace_sec_per_km?: number
  kind: string
}

type Props = {
  volume: Point[]
  pace10k: Point[]
}

function shortWeek(iso: string): string {
  const parts = iso.split('-W')
  return parts.length === 2 ? `S${parts[1]}` : iso.slice(-5)
}

export function ProjectionChart({ volume, pace10k }: Props) {
  const option = useMemo((): EChartsOption | null => {
    if (volume.length < 2 && pace10k.length < 2) return null
    const weeks = (volume.length ? volume : pace10k).map((p) => shortWeek(p.week))
    const volHist = volume.map((p) =>
      p.kind === 'history' && p.distance_km != null ? p.distance_km : null,
    )
    const volProj = volume.map((p) =>
      p.kind === 'projected' && p.distance_km != null ? p.distance_km : null,
    )
    const paceHist = pace10k.map((p) =>
      p.kind === 'history' && p.pace_sec_per_km != null ? p.pace_sec_per_km : null,
    )
    const paceProj = pace10k.map((p) =>
      p.kind === 'projected' && p.pace_sec_per_km != null ? p.pace_sec_per_km : null,
    )

    return {
      animation: false,
      legend: {
        bottom: 0,
        left: 'center',
        itemGap: 16,
        itemWidth: 14,
        itemHeight: 10,
        data: ['Volume (passé)', 'Volume (projeté)', 'Allure 10k (passé)', 'Allure 10k (projeté)'],
        textStyle: { color: '#5c6f62', fontSize: 11 },
      },
      grid: { left: 52, right: 56, top: 36, bottom: 64 },
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: weeks,
        axisLabel: { color: '#5c6f62', fontSize: 11, hideOverlap: true },
        axisLine: { lineStyle: { color: 'rgba(20,32,24,0.14)' } },
      },
      yAxis: [
        {
          type: 'value',
          name: 'km',
          nameLocation: 'end',
          nameGap: 8,
          nameTextStyle: { color: '#1a5c3a', fontWeight: 600 },
          splitLine: { lineStyle: { color: 'rgba(20,32,24,0.08)' } },
          axisLabel: { color: '#5c6f62' },
        },
        {
          type: 'value',
          name: 'allure',
          // Inverse axis: 'start' keeps the name at the visual top (with km).
          nameLocation: 'start',
          nameGap: 8,
          inverse: true,
          scale: true,
          nameTextStyle: { color: '#2d6a8f', fontWeight: 600 },
          axisLabel: {
            color: '#5c6f62',
            formatter: (v: number) => formatPaceSec(v).replace(' /km', ''),
          },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: 'Volume (passé)',
          type: 'bar',
          data: volHist,
          itemStyle: { color: '#1a5c3a' },
        },
        {
          name: 'Volume (projeté)',
          type: 'bar',
          data: volProj,
          itemStyle: { color: 'rgba(45,122,82,0.35)' },
        },
        {
          name: 'Allure 10k (passé)',
          type: 'line',
          yAxisIndex: 1,
          data: paceHist,
          showSymbol: true,
          lineStyle: { color: '#2d6a8f', width: 2 },
          itemStyle: { color: '#2d6a8f' },
        },
        {
          name: 'Allure 10k (projeté)',
          type: 'line',
          yAxisIndex: 1,
          data: paceProj,
          showSymbol: true,
          lineStyle: { color: '#2d6a8f', width: 2, type: 'dashed' },
          itemStyle: { color: '#2d6a8f' },
        },
      ],
    }
  }, [volume, pace10k])

  if (!option) {
    return <p className="muted">Pas assez de données pour projeter.</p>
  }

  return (
    <div className="charts-wrap">
      <p className="muted charts-hint">
        Historique plein · projection en pointillés / barres plus claires (déterministe).
      </p>
      <ReactECharts option={option} style={{ height: 360, width: '100%' }} notMerge lazyUpdate />
    </div>
  )
}

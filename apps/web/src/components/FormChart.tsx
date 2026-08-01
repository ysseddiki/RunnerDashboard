import { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import type { FormSnapshot, LoadSeriesPoint } from '../types'

type Props = {
  series: LoadSeriesPoint[]
  form: FormSnapshot | null | undefined
  emptyReason?: string | null
}

export function FormChart({ series, form, emptyReason }: Props) {
  const option = useMemo((): EChartsOption | null => {
    if (series.length < 2) return null
    const dates = series.map((p) => p.date.slice(5)) // MM-DD
    return {
      animation: false,
      tooltip: { trigger: 'axis' },
      legend: {
        data: ['CTL', 'ATL', 'TSB'],
        bottom: 0,
        textStyle: { color: '#3d4f42' },
      },
      grid: { left: 48, right: 24, top: 28, bottom: 48 },
      xAxis: {
        type: 'category',
        data: dates,
        boundaryGap: false,
        axisLabel: { color: '#5c6f62', fontSize: 11 },
      },
      yAxis: {
        type: 'value',
        scale: true,
        splitLine: { lineStyle: { color: 'rgba(20,32,24,0.08)' } },
        axisLabel: { color: '#5c6f62' },
      },
      series: [
        {
          name: 'CTL',
          type: 'line',
          showSymbol: false,
          data: series.map((p) => p.ctl),
          lineStyle: { width: 2, color: '#1a4f8c' },
          itemStyle: { color: '#1a4f8c' },
        },
        {
          name: 'ATL',
          type: 'line',
          showSymbol: false,
          data: series.map((p) => p.atl),
          lineStyle: { width: 2, color: '#8a5a12' },
          itemStyle: { color: '#8a5a12' },
        },
        {
          name: 'TSB',
          type: 'line',
          showSymbol: false,
          data: series.map((p) => p.tsb),
          lineStyle: { width: 2, color: '#2d6a8f', type: 'dashed' },
          itemStyle: { color: '#2d6a8f' },
          markLine: {
            silent: true,
            symbol: 'none',
            data: [{ yAxis: 0, lineStyle: { color: 'rgba(20,32,24,0.25)' } }],
          },
        },
      ],
    }
  }, [series])

  if (!option) {
    return (
      <p className="muted">
        {emptyReason ||
          'Pas assez de données TRIMP pour tracer la forme (FC + zones profil requis).'}
      </p>
    )
  }

  const status = form?.status_label_fr
  const statusClass = form?.status ? `form-status form-${form.status}` : 'form-status'

  return (
    <div className="form-chart-wrap">
      <div className="form-chart-head">
        {status && <span className={statusClass}>{status}</span>}
        {form?.available && (
          <span className="muted form-metrics">
            ATL {form.atl?.toFixed(0)} · CTL {form.ctl?.toFixed(0)} · TSB{' '}
            {form.tsb != null && form.tsb > 0 ? '+' : ''}
            {form.tsb?.toFixed(0)}
          </span>
        )}
      </div>
      {form?.warmup_note_fr && <p className="muted form-warmup">{form.warmup_note_fr}</p>}
      <ReactECharts option={option} style={{ height: 260, width: '100%' }} notMerge lazyUpdate />
    </div>
  )
}

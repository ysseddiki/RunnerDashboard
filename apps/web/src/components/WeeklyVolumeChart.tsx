type WeekPoint = {
  week: string
  distance_km: number
  runs: number
}

type Props = {
  weeks: WeekPoint[]
}

function shortWeekLabel(isoWeek: string): string {
  // Expects formats like 2026-W12 or similar — show last token
  const parts = isoWeek.split('-W')
  if (parts.length === 2) return `S${parts[1]}`
  return isoWeek.slice(-5)
}

export function WeeklyVolumeChart({ weeks }: Props) {
  const data = weeks.slice(-8)
  const max = Math.max(...data.map((w) => w.distance_km), 1)

  return (
    <div className="week-chart" role="img" aria-label="Volume hebdomadaire en kilomètres">
      {data.map((w, i) => {
        const heightPct = Math.max((w.distance_km / max) * 100, w.distance_km > 0 ? 6 : 2)
        return (
          <div
            key={w.week}
            className="week-col"
            title={`${w.week} · ${w.distance_km} km · ${w.runs} sortie${w.runs > 1 ? 's' : ''}`}
          >
            <div className="week-bar-track">
              <div
                className="week-bar"
                style={{
                  height: `${heightPct}%`,
                  animationDelay: `${i * 0.04}s`,
                }}
              />
            </div>
            <span className="week-km">{w.distance_km}</span>
            <span className="week-label">{shortWeekLabel(w.week)}</span>
          </div>
        )
      })}
    </div>
  )
}

import type { StreamPayload, StreamPoint } from './types'

function numericStream(stream: StreamPayload | undefined): number[] {
  if (!stream?.data?.length) return []
  const first = stream.data[0]
  if (typeof first === 'number') return stream.data as number[]
  return []
}

function latlngStream(stream: StreamPayload | undefined): Array<[number, number]> {
  if (!stream?.data?.length) return []
  const first = stream.data[0]
  if (Array.isArray(first) && first.length >= 2) {
    return stream.data as Array<[number, number]>
  }
  return []
}

/** Strava cadence stream is typically RPM (one foot); display as PPM. */
function cadenceToPpm(rpm: number | null | undefined): number | null {
  if (rpm == null || !Number.isFinite(rpm)) return null
  return Math.round(rpm * 2)
}

export function buildStreamPoints(
  streams: Record<string, StreamPayload> | null | undefined,
): StreamPoint[] {
  if (!streams) return []
  const time = numericStream(streams.time)
  const distance = numericStream(streams.distance)
  const velocity = numericStream(streams.velocity_smooth)
  const heartrate = numericStream(streams.heartrate)
  const cadence = numericStream(streams.cadence)
  const altitude = numericStream(streams.altitude)
  const watts = numericStream(streams.watts)
  const latlng = latlngStream(streams.latlng)

  const n = Math.max(
    time.length,
    distance.length,
    velocity.length,
    heartrate.length,
    cadence.length,
    altitude.length,
    watts.length,
    latlng.length,
  )
  if (n === 0) return []

  const points: StreamPoint[] = []
  for (let i = 0; i < n; i += 1) {
    const speed = velocity[i] ?? null
    const dist = distance[i] ?? (i > 0 ? (points[i - 1]?.distance_m ?? 0) : 0)
    points.push({
      index: i,
      time_s: time[i] ?? i,
      distance_m: dist,
      distance_km: dist / 1000,
      pace_sec_per_km: speed != null && speed > 0.2 ? 1000 / speed : null,
      speed_mps: speed,
      heartrate: heartrate[i] ?? null,
      cadence_ppm: cadenceToPpm(cadence[i]),
      altitude_m: altitude[i] ?? null,
      watts: watts[i] ?? null,
      lat: latlng[i]?.[0] ?? null,
      lng: latlng[i]?.[1] ?? null,
    })
  }
  return points
}

/** Keep charts responsive while preserving shape. */
export function downsamplePoints(points: StreamPoint[], maxPoints = 2500): StreamPoint[] {
  if (points.length <= maxPoints) return points
  const step = points.length / maxPoints
  const out: StreamPoint[] = []
  for (let i = 0; i < maxPoints; i += 1) {
    out.push(points[Math.floor(i * step)]!)
  }
  const last = points[points.length - 1]!
  if (out[out.length - 1]?.index !== last.index) out.push(last)
  return out
}

export function extractLatLngPath(
  streams: Record<string, StreamPayload> | null | undefined,
): Array<[number, number]> {
  const fromStream = latlngStream(streams?.latlng)
  if (fromStream.length >= 2) return fromStream
  return []
}

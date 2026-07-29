import { useEffect, useMemo } from 'react'
import { MapContainer, Polyline, TileLayer, CircleMarker, useMap } from 'react-leaflet'
import polyline from '@mapbox/polyline'
import 'leaflet/dist/leaflet.css'
import type { ActivityDetail } from '../types'
import { extractLatLngPath } from '../streams'

function FitBounds({ positions }: { positions: Array<[number, number]> }) {
  const map = useMap()
  useEffect(() => {
    if (positions.length < 2) return
    map.fitBounds(positions, { padding: [28, 28] })
  }, [map, positions])
  return null
}

function decodeSummary(encoded: string | null | undefined): Array<[number, number]> {
  if (!encoded) return []
  try {
    return polyline.decode(encoded) as Array<[number, number]>
  } catch {
    return []
  }
}

type Props = {
  activity: ActivityDetail
}

export function ActivityMap({ activity }: Props) {
  const positions = useMemo(() => {
    const fromStreams = extractLatLngPath(activity.streams_json)
    if (fromStreams.length >= 2) return fromStreams
    return decodeSummary(activity.summary_polyline)
  }, [activity.streams_json, activity.summary_polyline])

  if (positions.length < 2) {
    return (
      <p className="muted map-empty">
        Pas de trace GPS (indoor, GPS manquant, ou polyline absente).
      </p>
    )
  }

  const start = positions[0]!
  const end = positions[positions.length - 1]!
  const center: [number, number] = [
    (start[0] + end[0]) / 2,
    (start[1] + end[1]) / 2,
  ]

  return (
    <div className="map-wrap">
      <MapContainer center={center} zoom={13} scrollWheelZoom className="run-map">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Polyline positions={positions} pathOptions={{ color: '#1f4d36', weight: 4, opacity: 0.9 }} />
        <CircleMarker
          center={start}
          radius={7}
          pathOptions={{ color: '#1f4d36', fillColor: '#3d8b5f', fillOpacity: 1 }}
        />
        <CircleMarker
          center={end}
          radius={7}
          pathOptions={{ color: '#8a1f1f', fillColor: '#c44', fillOpacity: 1 }}
        />
        <FitBounds positions={positions} />
      </MapContainer>
    </div>
  )
}

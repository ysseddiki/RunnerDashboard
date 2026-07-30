/** WMO weather codes → icône visuelle + classe CSS. */

export type WeatherVisual = {
  key: string
  label: string
  className: string
}

export function weatherVisual(
  code: number | null | undefined,
  labelFr?: string | null,
): WeatherVisual {
  const c = code ?? -1
  if (c === 0 || c === 1) {
    return { key: 'clear', label: labelFr || 'Clair', className: 'weather-clear' }
  }
  if (c === 2) {
    return { key: 'partly', label: labelFr || 'Nuages', className: 'weather-partly' }
  }
  if (c === 3) {
    return { key: 'cloudy', label: labelFr || 'Couvert', className: 'weather-cloudy' }
  }
  if (c === 45 || c === 48) {
    return { key: 'fog', label: labelFr || 'Brouillard', className: 'weather-fog' }
  }
  if (c >= 51 && c <= 67) {
    return { key: 'rain', label: labelFr || 'Pluie', className: 'weather-rain' }
  }
  if (c >= 71 && c <= 77) {
    return { key: 'snow', label: labelFr || 'Neige', className: 'weather-snow' }
  }
  if (c >= 80 && c <= 82) {
    return { key: 'showers', label: labelFr || 'Averses', className: 'weather-rain' }
  }
  if (c >= 95) {
    return { key: 'storm', label: labelFr || 'Orage', className: 'weather-storm' }
  }
  return { key: 'unknown', label: labelFr || 'Météo', className: 'weather-unknown' }
}

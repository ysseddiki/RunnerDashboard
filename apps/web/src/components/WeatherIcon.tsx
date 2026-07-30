import type { WeatherVisual } from '../weatherVisual'

type Props = {
  visual: WeatherVisual
  className?: string
}

/** Icônes SVG minimalistes (pas d’emoji). */
export function WeatherIcon({ visual, className = '' }: Props) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    className: `weather-svg ${className}`.trim(),
  }

  switch (visual.key) {
    case 'clear':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2.2M12 19.8V22M4.2 12H2M22 12h-2.2M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M5.6 18.4l1.6-1.6M16.8 7.2l1.6-1.6" />
        </svg>
      )
    case 'partly':
      return (
        <svg {...common}>
          <circle cx="9" cy="10" r="3.2" />
          <path d="M9 4.2V6M4.2 10H2.5M5.4 5.4l1.2 1.2" />
          <path d="M10 16.5a4.5 4.5 0 1 1 7.8-3.2A3.4 3.4 0 1 1 18.5 16.5H10Z" />
        </svg>
      )
    case 'cloudy':
      return (
        <svg {...common}>
          <path d="M7.5 17.5a4.5 4.5 0 1 1 7.8-3.2A3.4 3.4 0 1 1 16 17.5H7.5Z" />
        </svg>
      )
    case 'fog':
      return (
        <svg {...common}>
          <path d="M4 9h16M5 12.5h14M6 16h12" />
        </svg>
      )
    case 'rain':
    case 'showers':
      return (
        <svg {...common}>
          <path d="M7.5 14a4.5 4.5 0 1 1 7.8-3.2A3.4 3.4 0 1 1 16 14H7.5Z" />
          <path d="M9.5 16.5 8.2 20M12.5 16.5 11.2 20M15.5 16.5 14.2 20" />
        </svg>
      )
    case 'snow':
      return (
        <svg {...common}>
          <path d="M7.5 13.5a4.5 4.5 0 1 1 7.8-3.2A3.4 3.4 0 1 1 16 13.5H7.5Z" />
          <path d="M9.5 16.5v3.2M12.5 16.5v3.2M15.5 16.5v3.2" />
        </svg>
      )
    case 'storm':
      return (
        <svg {...common}>
          <path d="M7.5 13a4.5 4.5 0 1 1 7.8-3.2A3.4 3.4 0 1 1 16 13H7.5Z" />
          <path d="m11 14 2.2 3.2h-2L13.5 21" />
        </svg>
      )
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="7" />
          <path d="M12 8.5v4M12 15.5h.01" />
        </svg>
      )
  }
}

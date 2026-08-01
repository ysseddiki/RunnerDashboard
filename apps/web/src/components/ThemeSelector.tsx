import { useState, type ReactNode } from 'react'
import { readThemePreference, saveThemePreference, type ThemePreference } from '../theme'

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'clair', label: 'Clair' },
  { value: 'sombre', label: 'Sombre' },
  { value: 'systeme', label: 'Système' },
]

type ThemeSelectorProps = {
  className?: string
  legend?: ReactNode
}

export function ThemeSelector({ className = '', legend = 'Apparence' }: ThemeSelectorProps) {
  const [pref, setPref] = useState<ThemePreference>(() => readThemePreference())

  function choose(next: ThemePreference) {
    setPref(next)
    saveThemePreference(next)
  }

  return (
    <fieldset className={`theme-fieldset ${className}`.trim()}>
      <legend className="sr-only">{legend}</legend>
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className="theme-option"
          aria-pressed={pref === opt.value}
          onClick={() => choose(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </fieldset>
  )
}

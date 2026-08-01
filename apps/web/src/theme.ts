export type ThemePreference = 'clair' | 'sombre' | 'systeme'

export const THEME_STORAGE_KEY = 'rd-theme'

export function readThemePreference(): ThemePreference {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY)
    if (raw === 'clair' || raw === 'sombre' || raw === 'systeme') return raw
  } catch {
    /* ignore */
  }
  return 'systeme'
}

export function resolveTheme(pref: ThemePreference): 'light' | 'dark' {
  if (pref === 'clair') return 'light'
  if (pref === 'sombre') return 'dark'
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }
  return 'light'
}

export function applyTheme(pref: ThemePreference) {
  const resolved = resolveTheme(pref)
  document.documentElement.setAttribute('data-theme', resolved)
  document.documentElement.style.colorScheme = resolved
}

export function saveThemePreference(pref: ThemePreference) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, pref)
  } catch {
    /* ignore */
  }
  applyTheme(pref)
}

/** Apply stored preference and keep `système` in sync with OS changes. */
export function initTheme() {
  applyTheme(readThemePreference())

  if (typeof window === 'undefined' || !window.matchMedia) return () => {}

  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const onChange = () => {
    if (readThemePreference() === 'systeme') applyTheme('systeme')
  }
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

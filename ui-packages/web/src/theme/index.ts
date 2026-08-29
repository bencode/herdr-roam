export const themePreferences = ['system', 'light', 'dark'] as const

export type ThemePreference = (typeof themePreferences)[number]

export const THEME_STORAGE_KEY = 'herdr-roam.theme.v1'

export const isThemePreference = (value: unknown): value is ThemePreference =>
  typeof value === 'string' && themePreferences.some(theme => theme === value)

export const readThemePreference = (): ThemePreference => {
  try {
    const value = globalThis.localStorage?.getItem(THEME_STORAGE_KEY)
    return isThemePreference(value) ? value : 'system'
  } catch (error) {
    console.error('theme preference read failed', error)
    return 'system'
  }
}

export const applyThemePreference = (theme: ThemePreference): void => {
  globalThis.document?.documentElement.setAttribute('data-theme', theme)
}

export const writeThemePreference = (theme: ThemePreference): void => {
  applyThemePreference(theme)
  try {
    globalThis.localStorage?.setItem(THEME_STORAGE_KEY, theme)
  } catch (error) {
    console.error('theme preference write failed', error)
  }
}

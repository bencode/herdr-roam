import {
  applyThemePreference,
  readThemePreference,
  THEME_STORAGE_KEY,
  writeThemePreference,
} from '.'

describe('theme preference', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  it('defaults invalid or absent preferences to System', () => {
    expect(readThemePreference()).toBe('system')

    localStorage.setItem(THEME_STORAGE_KEY, 'contrast')
    expect(readThemePreference()).toBe('system')
  })

  it('applies and persists each supported preference', () => {
    applyThemePreference('light')
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')

    writeThemePreference('dark')
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')

    writeThemePreference('system')
    expect(document.documentElement).toHaveAttribute('data-theme', 'system')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('system')
  })
})

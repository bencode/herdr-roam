import { create } from 'zustand'

export const readingThemes = ['auto', 'light', 'paper', 'dark'] as const
export const readingWidths = ['focused', 'full'] as const
export const READING_FONT_SIZE = { min: 12, max: 20 } as const

export type ReadingTheme = (typeof readingThemes)[number]
export type ReadingWidth = (typeof readingWidths)[number]

export type ReadingPreferences = {
  readonly fontSize: number
  readonly width: ReadingWidth
  readonly theme: ReadingTheme
}

type ReadingPreferencesStore = ReadingPreferences & {
  readonly update: (patch: Partial<ReadingPreferences>) => void
}

const STORAGE_KEY = 'herdr-roam.reading.v1'

const defaultPreferences: ReadingPreferences = { fontSize: 16, width: 'focused', theme: 'auto' }

const isOneOf = <T extends string>(values: readonly T[], value: unknown): value is T =>
  values.some(item => item === value)

const parsePreferences = (value: unknown): ReadingPreferences | null => {
  if (typeof value !== 'object' || value === null) return null
  const { fontSize, width, theme } = value as Record<string, unknown>
  if (
    typeof fontSize !== 'number' ||
    !Number.isInteger(fontSize) ||
    fontSize < READING_FONT_SIZE.min ||
    fontSize > READING_FONT_SIZE.max ||
    !isOneOf(readingWidths, width) ||
    !isOneOf(readingThemes, theme)
  ) {
    return null
  }
  return { fontSize, width, theme }
}

const readPreferences = (): ReadingPreferences => {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY)
    if (!raw) return defaultPreferences
    const parsed = parsePreferences(JSON.parse(raw))
    if (parsed) return parsed
    console.error('reading preferences are invalid; using defaults')
  } catch (error) {
    console.error('reading preferences read failed', error)
  }
  return defaultPreferences
}

const persist = (preferences: ReadingPreferences): void => {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(preferences))
  } catch (error) {
    console.error('reading preferences write failed', error)
  }
}

export const useReadingPreferences = create<ReadingPreferencesStore>(set => ({
  ...readPreferences(),
  update: patch =>
    set(state => {
      const next = { fontSize: state.fontSize, width: state.width, theme: state.theme, ...patch }
      persist(next)
      return next
    }),
}))

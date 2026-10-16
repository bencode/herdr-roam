import { createContext } from 'react'

export type ReadingFocus = {
  readonly focused: boolean
  readonly toggle: () => void
}

export const ReadingFocusContext = createContext<ReadingFocus | null>(null)

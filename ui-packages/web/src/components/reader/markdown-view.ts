import type { FileView } from '@herdr-roam/shared'
import { useState } from 'react'

export type MarkdownMode = 'preview' | 'source'

export type MarkdownView = {
  readonly mode: MarkdownMode
  readonly setMode: (mode: MarkdownMode) => void
  readonly outlineOpen: boolean
  readonly setOutlineOpen: (open: boolean) => void
}

export const useMarkdownView = (): MarkdownView => {
  const [mode, setMode] = useState<MarkdownMode>('preview')
  const [outlineOpen, setOutlineOpen] = useState(true)
  return { mode, setMode, outlineOpen, setOutlineOpen }
}

export const isMarkdownLike = (file: FileView): boolean =>
  file.kind === 'markdown' || file.kind === 'mermaid'

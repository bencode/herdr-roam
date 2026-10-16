import { z } from 'zod'
import type { DiffMode } from './diff-view'

const key = 'herdr-roam.compare.v1'
const schema = z.object({
  mode: z.enum(['split', 'unified']).optional(),
  wrap: z.boolean().default(false),
  treeWidth: z.number().min(180).optional(),
  targets: z.record(z.string(), z.string()).default({}),
})
type Preferences = z.infer<typeof schema>

export const readComparePreferences = (): Preferences => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? schema.parse(JSON.parse(raw)) : { wrap: false, targets: {} }
  } catch (error) {
    console.error('Comparison preference read failed', error)
    return { wrap: false, targets: {} }
  }
}

export const writeComparePreference = (preference: {
  readonly mode?: DiffMode
  readonly wrap?: boolean
  readonly treeWidth?: number
  readonly target?: { readonly projectName: string; readonly ref: string }
}): void => {
  try {
    const current = readComparePreferences()
    localStorage.setItem(
      key,
      JSON.stringify({
        ...current,
        ...(preference.mode === undefined ? {} : { mode: preference.mode }),
        ...(preference.wrap === undefined ? {} : { wrap: preference.wrap }),
        ...(preference.treeWidth === undefined ? {} : { treeWidth: preference.treeWidth }),
        targets: preference.target
          ? { ...current.targets, [preference.target.projectName]: preference.target.ref }
          : current.targets,
      }),
    )
  } catch (error) {
    console.error('Comparison preference write failed', error)
  }
}

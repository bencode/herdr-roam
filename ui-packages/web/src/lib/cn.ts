import { extendTailwindMerge } from 'tailwind-merge'

// `text-2xs` is a project font-size token; without this tailwind-merge reads it as a color.
const merge = extendTailwindMerge({ extend: { theme: { text: ['2xs'] } } })

export const cn = (...values: ReadonlyArray<string | false | null | undefined>): string =>
  merge(values.filter(Boolean).join(' '))

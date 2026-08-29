export const cn = (...values: ReadonlyArray<string | false | null | undefined>): string =>
  values.filter(Boolean).join(' ')

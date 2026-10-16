import type { CompareFile } from '@herdr-roam/shared'

export const filePath = (entry: Pick<CompareFile, 'newPath' | 'oldPath'>): string =>
  entry.newPath ?? entry.oldPath ?? ''

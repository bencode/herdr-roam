import { afterEach, expect, it } from 'vitest'
import { readComparePreferences, writeComparePreference } from './preferences'

afterEach(() => localStorage.clear())

it('persists tree width without losing existing view preferences or branch targets', () => {
  localStorage.setItem(
    'herdr-roam.compare.v1',
    JSON.stringify({
      mode: 'split',
      wrap: true,
      targets: { fixture: 'refs/heads/main' },
    }),
  )
  writeComparePreference({ treeWidth: 380 })
  expect(readComparePreferences()).toEqual({
    mode: 'split',
    wrap: true,
    treeWidth: 380,
    targets: { fixture: 'refs/heads/main' },
  })
  writeComparePreference({
    mode: 'unified',
    target: { projectName: 'other', ref: 'refs/heads/develop' },
  })
  expect(readComparePreferences()).toEqual({
    mode: 'unified',
    wrap: true,
    treeWidth: 380,
    targets: { fixture: 'refs/heads/main', other: 'refs/heads/develop' },
  })
})

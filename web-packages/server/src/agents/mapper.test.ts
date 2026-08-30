import { describe, expect, it } from 'vitest'
import type { RawAgent } from '../herdr/schema.js'
import { mapAgent, mapObservedDirectories } from './mapper.js'

const raw = (values: Partial<RawAgent> = {}): RawAgent => ({
  terminal_id: 'terminal-1',
  agent_status: 'working',
  workspace_id: 'workspace-1',
  tab_id: 'tab-1',
  pane_id: 'w1:p1',
  ...values,
})

describe('Agent mapper', () => {
  it('uses the stable terminal id and pane attach target without project inference', () => {
    expect(
      mapAgent(
        raw({
          name: 'codex-product',
          agent: 'codex',
          cwd: '/work/root',
          foreground_cwd: '/work/root/packages/web',
        }),
      ),
    ).toEqual({
      id: 'terminal-1',
      name: 'codex-product',
      provider: 'codex',
      status: 'working',
      cwd: '/work/root/packages/web',
      attachTarget: 'w1:p1',
    })
  })

  it('falls back through Herdr titles and preserves unknown status', () => {
    expect(
      mapAgent(raw({ agent_status: 'unknown', terminal_title_stripped: 'Fallback title' })),
    ).toMatchObject({ name: 'Fallback title', status: 'unknown' })
  })

  it('aggregates Agent and Pane working directories without inventing Projects', () => {
    expect(
      mapObservedDirectories(
        [raw({ cwd: '/work/herdr-roam' })],
        [
          { pane_id: 'w1:p1', cwd: '/work/herdr-roam' },
          { pane_id: 'w1:p2', foreground_cwd: '/work/herdr' },
        ],
      ),
    ).toEqual([
      {
        path: '/work/herdr-roam',
        suggestedName: 'herdr-roam',
        agentCount: 1,
        paneCount: 1,
      },
      { path: '/work/herdr', suggestedName: 'herdr', agentCount: 0, paneCount: 1 },
    ])
  })
})

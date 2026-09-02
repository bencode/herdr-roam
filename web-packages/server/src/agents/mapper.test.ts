import { describe, expect, it } from 'vitest'
import type { RawAgent } from '../herdr/schema.js'
import { mapAgent } from './mapper.js'

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
      session: null,
    })
  })

  it('preserves Herdr native Session identity', () => {
    expect(
      mapAgent(
        raw({
          agent_session: {
            source: 'herdr:codex',
            agent: 'codex',
            kind: 'id',
            value: 'session-1',
          },
        }),
      ).session,
    ).toEqual({
      source: 'herdr:codex',
      agent: 'codex',
      kind: 'id',
      value: 'session-1',
    })
  })

  it('falls back through Herdr titles and preserves unknown status', () => {
    expect(
      mapAgent(raw({ agent_status: 'unknown', terminal_title_stripped: 'Fallback title' })),
    ).toMatchObject({ name: 'Fallback title', status: 'unknown' })
  })
})

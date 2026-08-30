import { act, render, screen } from '@testing-library/react'
import type { AgentRuntimeSnapshot } from '@herdr-roam/shared'
import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  subscribe: vi.fn(),
  listener: null as ((snapshot: AgentRuntimeSnapshot) => void) | null,
}))

vi.mock('../client', () => ({
  fetchAgentSnapshot: mocks.fetch,
  subscribeAgentSnapshots: vi.fn((listener: (snapshot: AgentRuntimeSnapshot) => void) => {
    mocks.listener = listener
    return () => undefined
  }),
}))

import { AgentRuntimeProvider, useAgentRuntime } from '.'

const Probe = () => {
  const { snapshot } = useAgentRuntime()
  return <output>{`${snapshot.source.state}:${snapshot.items.length}:${snapshot.stale}`}</output>
}

describe('Agent runtime provider', () => {
  it('loads the initial snapshot and fully replaces it from SSE', async () => {
    mocks.fetch.mockResolvedValue({
      source: { state: 'connected', version: '0.8.2', protocol: 20 },
      stale: false,
      observedDirectories: [],
      items: [],
    })
    render(
      <AgentRuntimeProvider>
        <Probe />
      </AgentRuntimeProvider>,
    )
    expect(await screen.findByText('connected:0:false')).toBeVisible()

    act(() => {
      mocks.listener?.({
        source: {
          state: 'reconnecting',
          code: 'herdr_unavailable',
          message: 'reconnecting',
        },
        stale: true,
        observedDirectories: [],
        items: [
          {
            id: 'terminal-1',
            name: 'codex',
            provider: 'codex',
            status: 'idle',
            cwd: null,
            attachTarget: 'w1:p1',
          },
        ],
      })
    })
    expect(screen.getByText('reconnecting:1:true')).toBeVisible()
  })
})

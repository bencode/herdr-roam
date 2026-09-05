import type { AgentRuntimeSnapshot, AgentSummary } from '@herdr-roam/shared'
import { act, fireEvent, render, screen } from '@testing-library/react'
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
  const { snapshot, registerStartedAgent } = useAgentRuntime()
  return (
    <>
      <output>{`${snapshot.source.state}:${snapshot.items.length}:${snapshot.stale}`}</output>
      <button type="button" onClick={() => registerStartedAgent(started)}>
        Register started Agent
      </button>
      {snapshot.items.map(agent => (
        <span key={agent.id}>
          {agent.name} {agent.status}
        </span>
      ))}
    </>
  )
}

const started: AgentSummary = {
  id: 'terminal-1',
  name: 'codex-task',
  provider: 'codex',
  status: 'idle',
  cwd: '/tmp/task',
  attachTarget: 'w1:p1',
  session: null,
}

describe('Agent runtime provider', () => {
  it('uses the launch receipt immediately and still replaces Agents from authoritative snapshots', async () => {
    const connected: AgentRuntimeSnapshot = {
      source: { state: 'connected', version: '0.8.2', protocol: 20 },
      stale: false,
      items: [],
    }
    mocks.fetch.mockResolvedValue(connected)
    render(
      <AgentRuntimeProvider>
        <Probe />
      </AgentRuntimeProvider>,
    )
    await screen.findByText('connected:0:false')
    fireEvent.click(screen.getByRole('button', { name: 'Register started Agent' }))
    expect(screen.getByText('codex-task idle')).toBeVisible()
    act(() => mocks.listener?.({ ...connected, items: [{ ...started, status: 'working' }] }))
    fireEvent.click(screen.getByRole('button', { name: 'Register started Agent' }))
    expect(screen.getByText('codex-task working')).toBeVisible()
    expect(screen.getByText('connected:1:false')).toBeVisible()
    act(() => mocks.listener?.(connected))
    expect(screen.queryByText('codex-task working')).not.toBeInTheDocument()
  })

  it('loads the initial snapshot and fully replaces it from SSE', async () => {
    mocks.fetch.mockResolvedValue({
      source: { state: 'connected', version: '0.8.2', protocol: 20 },
      stale: false,
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
        items: [
          {
            id: 'terminal-1',
            name: 'codex',
            provider: 'codex',
            status: 'idle',
            cwd: null,
            attachTarget: 'w1:p1',
            session: null,
          },
        ],
      })
    })
    expect(screen.getByText('reconnecting:1:true')).toBeVisible()
  })
})

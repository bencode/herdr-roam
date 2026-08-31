import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const runtime = vi.hoisted(() => ({
  snapshot: {
    source: { state: 'connected' as const, version: '0.8.2', protocol: 20 },
    stale: false,
    items: [
      {
        id: 'idle-1',
        name: 'claude-review',
        provider: 'claude',
        status: 'idle' as const,
        cwd: '/work/review/',
        attachTarget: 'w1:p2',
      },
      {
        id: 'blocked-1',
        name: 'codex-api',
        provider: 'codex',
        status: 'blocked' as const,
        cwd: '/work/api',
        attachTarget: 'w1:p1',
      },
    ],
  },
}))

vi.mock('../runtime-provider', () => ({
  useAgentRuntime: () => ({
    snapshot: runtime.snapshot,
    transportError: null,
    agentById: (id: string) => runtime.snapshot.items.find(agent => agent.id === id),
  }),
}))

import { AgentList } from '.'
import { agentDirectoryLabel } from '../presentation'

describe('Agent list', () => {
  it('derives concise directory labels across path formats', () => {
    expect(agentDirectoryLabel('/work/review/')).toBe('review')
    expect(agentDirectoryLabel('C:\\work\\review\\')).toBe('review')
    expect(agentDirectoryLabel('/')).toBe('/')
  })

  it('groups raw statuses in attention order and opens an Agent resource', () => {
    const onOpen = vi.fn()
    render(<AgentList activeAgentId="blocked-1" onOpen={onOpen} />)

    const headings = screen.getAllByRole('heading').map(heading => heading.textContent)
    expect(headings).toEqual(['Blocked1', 'Idle1'])
    const activeAgent = screen.getByRole('button', { name: /codex-api/ })
    expect(activeAgent).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: /claude-review/ })).not.toHaveAttribute(
      'aria-current',
    )
    expect(activeAgent).toHaveTextContent('Codex · api')
    expect(screen.getByRole('button', { name: /claude-review/ })).toHaveTextContent(
      'Claude · review',
    )
    expect(activeAgent).toHaveAttribute('title', '/work/api')
    fireEvent.click(activeAgent)
    expect(onOpen).toHaveBeenCalledWith({ type: 'agent', agentId: 'blocked-1' })
  })

  it('searches name, provider, and cwd', () => {
    render(<AgentList activeAgentId={null} onOpen={() => undefined} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Search agents' }), {
      target: { value: '/work/review/' },
    })
    expect(screen.getByText('claude-review')).toBeVisible()
    expect(screen.queryByText('codex-api')).not.toBeInTheDocument()
  })
})

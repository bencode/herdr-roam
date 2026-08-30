import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { AgentStatus } from '@herdr-roam/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  output: vi.fn(),
  prompt: vi.fn(),
  agent: {
    id: 'terminal-1',
    name: 'codex-product',
    provider: 'codex',
    status: 'idle' as AgentStatus,
    cwd: '/work/herdr-roam',
    attachTarget: 'w1:p1',
  },
}))

vi.mock('../client', () => ({
  fetchAgentOutput: mocks.output,
  submitAgentPrompt: mocks.prompt,
}))
vi.mock('../runtime-provider', () => ({
  useAgentRuntime: () => ({
    snapshot: {
      source: { state: 'connected', version: '0.8.2', protocol: 20 },
      stale: false,
      items: [mocks.agent],
    },
    transportError: null,
    agentById: (id: string) => (id === mocks.agent.id ? mocks.agent : undefined),
  }),
}))

import { AgentTab } from '.'

describe('Agent Inspector', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.agent.status = 'idle'
    mocks.output.mockResolvedValue({ agentId: 'terminal-1', text: 'Recent terminal output' })
    mocks.prompt.mockResolvedValue({ agentId: 'terminal-1' })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })

  afterEach(() => vi.restoreAllMocks())

  it('reads recent output and copies the native attach command', async () => {
    render(<AgentTab resource={{ type: 'agent', agentId: 'terminal-1' }} />)
    expect(await screen.findByText('Recent terminal output')).toBeVisible()
    expect(screen.getByRole('region', { name: 'Live output' })).toBeVisible()
    expect(screen.queryByText('Live output')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Copy attach command' }))
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('herdr agent attach w1:p1'),
    )
  })

  it('reveals Agent details only when requested', async () => {
    render(<AgentTab resource={{ type: 'agent', agentId: 'terminal-1' }} />)
    expect(await screen.findByText('Recent terminal output')).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Agent details' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Details' }))
    expect(screen.getByRole('heading', { name: 'Agent details' })).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Close Agent details' }))
    expect(screen.queryByRole('heading', { name: 'Agent details' })).not.toBeInTheDocument()
  })

  it('submits a Prompt and clears the draft after success', async () => {
    render(<AgentTab resource={{ type: 'agent', agentId: 'terminal-1' }} />)
    expect(await screen.findByText('Recent terminal output')).toBeVisible()
    const composer = screen.getByRole('textbox', { name: 'Send a Prompt' })
    expect(composer).toHaveAttribute('rows', '2')
    fireEvent.change(composer, { target: { value: 'Review the change.' } })
    fireEvent.keyDown(composer, { key: 'Enter', shiftKey: true })
    expect(mocks.prompt).not.toHaveBeenCalled()
    fireEvent.keyDown(composer, { key: 'Enter' })

    await waitFor(() =>
      expect(mocks.prompt).toHaveBeenCalledWith('terminal-1', 'Review the change.'),
    )
    expect(composer).toHaveValue('')
    expect(screen.getByText('Prompt submitted.')).toBeVisible()
  })

  it('keeps a draft when submission fails and disables sending while working', async () => {
    mocks.prompt.mockRejectedValueOnce(new Error('Prompt rejected'))
    const { unmount } = render(
      <AgentTab resource={{ type: 'agent', agentId: 'terminal-1' }} />,
    )
    expect(await screen.findByText('Recent terminal output')).toBeVisible()
    const composer = screen.getByRole('textbox', { name: 'Send a Prompt' })
    fireEvent.change(composer, { target: { value: 'Keep this draft.' } })
    fireEvent.keyDown(composer, { key: 'Enter' })
    expect(await screen.findByText('Prompt rejected')).toBeVisible()
    expect(composer).toHaveValue('Keep this draft.')
    unmount()

    mocks.agent.status = 'working'
    render(<AgentTab resource={{ type: 'agent', agentId: 'terminal-1' }} />)
    expect(await screen.findByText('Recent terminal output')).toBeVisible()
    fireEvent.change(screen.getByRole('textbox', { name: 'Send a Prompt' }), {
      target: { value: 'Wait for this.' },
    })
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Send a Prompt' }), { key: 'Enter' })
    expect(mocks.prompt).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/Agent is working/)).toBeVisible()
  })
})

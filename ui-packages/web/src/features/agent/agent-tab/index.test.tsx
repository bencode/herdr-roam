import type { AgentStatus } from '@herdr-roam/shared'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  output: vi.fn(),
  prompt: vi.fn(),
  input: vi.fn(),
  focus: vi.fn(),
  stop: vi.fn(),
  present: true,
  agent: {
    id: 'terminal-1',
    name: 'codex-product',
    provider: 'codex',
    status: 'idle' as AgentStatus,
    cwd: '/work/herdr-roam' as string | null,
    attachTarget: 'w1:p1',
    session: null as null | {
      source: string
      agent: 'codex'
      kind: 'id'
      value: string
    },
  },
}))

vi.mock('../client', () => ({
  fetchAgentOutput: mocks.output,
  submitAgentPrompt: mocks.prompt,
  sendAgentInput: mocks.input,
  focusAgentInHerdr: mocks.focus,
  stopAgent: mocks.stop,
}))
vi.mock('../runtime-provider', () => ({
  useAgentRuntime: () => ({
    snapshot: {
      source: { state: 'connected', version: '0.8.2', protocol: 20 },
      stale: false,
      items: mocks.present ? [mocks.agent] : [],
    },
    transportError: null,
    agentById: (id: string) =>
      mocks.present && id === mocks.agent.id ? mocks.agent : undefined,
  }),
}))

import { AgentTab } from '.'

describe('Agent Inspector', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.agent.status = 'idle'
    mocks.agent.cwd = '/work/herdr-roam'
    mocks.agent.session = null
    mocks.present = true
    mocks.output.mockResolvedValue({
      agentId: 'terminal-1',
      text: 'Recent terminal output',
      truncated: false,
    })
    mocks.prompt.mockResolvedValue({ agentId: 'terminal-1' })
    mocks.input.mockResolvedValue({ agentId: 'terminal-1' })
    mocks.focus.mockResolvedValue({ agentId: 'terminal-1' })
    mocks.stop.mockResolvedValue({ agentId: 'terminal-1' })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn().mockReturnValue('blob:screen'),
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    })
  })

  afterEach(() => vi.restoreAllMocks())

  it('reads recent output and copies the native attach command', async () => {
    render(<AgentTab resource={{ type: 'agent', agentId: 'terminal-1' }} />)
    expect(await screen.findByText('Recent terminal output')).toBeVisible()
    expect(screen.getByText('/work/herdr-roam')).toBeVisible()
    expect(screen.getByRole('region', { name: 'Live output' })).toBeVisible()
    expect(screen.queryByText('Live output')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Copy attach command' }))
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('herdr agent attach w1:p1'),
    )
  })

  it('discloses when only the bounded output tail is available', async () => {
    mocks.output.mockResolvedValue({
      agentId: 'terminal-1',
      text: 'Bounded terminal output',
      truncated: true,
    })
    render(<AgentTab resource={{ type: 'agent', agentId: 'terminal-1' }} />)

    expect(await screen.findByText('Bounded terminal output')).toBeVisible()
    expect(screen.getByText('Showing recent output')).toBeVisible()
  })

  it('reveals Agent details only when requested', async () => {
    render(<AgentTab resource={{ type: 'agent', agentId: 'terminal-1' }} />)
    expect(await screen.findByText('Recent terminal output')).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Agent details' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Details' }))
    expect(screen.getByRole('heading', { name: 'Agent details' })).toBeVisible()
    expect(screen.getByText('Working directory')).toBeVisible()
    expect(screen.getByText('Attach target')).toBeVisible()
    expect(screen.getAllByText('/work/herdr-roam')).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', { name: 'Copy working directory' }))
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('/work/herdr-roam'),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Close Agent details' }))
    expect(screen.queryByRole('heading', { name: 'Agent details' })).not.toBeInTheDocument()
  })

  it('handles a missing working directory', async () => {
    mocks.agent.cwd = null
    render(<AgentTab resource={{ type: 'agent', agentId: 'terminal-1' }} />)
    expect(await screen.findByText('Recent terminal output')).toBeVisible()
    expect(screen.getByText('Working directory unavailable')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Details' }))
    expect(screen.getByText('Unavailable')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Copy working directory' })).not.toBeInTheDocument()
  })

  it('uses the terminal as the only blocked input surface', async () => {
    mocks.agent.status = 'blocked'
    const { rerender } = render(<AgentTab resource={{ type: 'agent', agentId: 'terminal-1' }} />)
    expect(await screen.findByText('Recent terminal output')).toBeVisible()
    expect(screen.queryByRole('textbox', { name: 'Send a Prompt' })).not.toBeInTheDocument()
    expect(
      screen.queryByRole('region', { name: 'Agent response controls' }),
    ).not.toBeInTheDocument()
    const terminal = screen.getByRole('region', { name: 'Live output' })
    const input = screen.getByRole('textbox', { name: 'Agent terminal input' })
    expect(terminal).toHaveAttribute('tabindex', '0')
    expect(input).not.toHaveFocus()

    act(() => terminal.focus())
    expect(terminal).toHaveFocus()
    fireEvent.keyDown(terminal, { key: 'Enter' })
    expect(input).toHaveFocus()
    expect(mocks.input).not.toHaveBeenCalled()
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Tab', shiftKey: true })
    fireEvent.compositionStart(input)
    fireEvent.input(input, { target: { value: '继续测试。' } })
    fireEvent.compositionEnd(input)
    fireEvent.keyDown(input, { key: 'Escape' })

    await waitFor(() => expect(mocks.input).toHaveBeenCalledTimes(4))
    expect(mocks.input.mock.calls).toEqual([
      ['terminal-1', { type: 'keys', keys: ['down'] }],
      ['terminal-1', { type: 'keys', keys: ['shift+tab'] }],
      ['terminal-1', { type: 'text', text: '继续测试。' }],
      ['terminal-1', { type: 'keys', keys: ['esc'] }],
    ])
    expect(terminal).toHaveFocus()
    fireEvent.keyDown(terminal, { key: 'ArrowDown' })
    expect(mocks.input).toHaveBeenCalledTimes(4)

    fireEvent.keyDown(terminal, { key: 'Enter' })
    expect(input).toHaveFocus()

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Details' }))
    expect(input).not.toHaveFocus()

    const selection = window.getSelection()
    const range = document.createRange()
    range.selectNodeContents(terminal)
    selection?.removeAllRanges()
    selection?.addRange(range)
    fireEvent.mouseUp(terminal)
    expect(input).not.toHaveFocus()
    selection?.removeAllRanges()

    mocks.agent.status = 'idle'
    rerender(<AgentTab resource={{ type: 'agent', agentId: 'terminal-1' }} />)
    expect(screen.getByRole('textbox', { name: 'Send a Prompt' })).toBeVisible()
    expect(screen.queryByRole('textbox', { name: 'Agent terminal input' })).not.toBeInTheDocument()
  })

  it('keeps blocked input moving while output refreshes are coalesced', async () => {
    mocks.agent.status = 'blocked'
    let finishRefresh:
      | ((value: { agentId: string; text: string; truncated: boolean }) => void)
      | undefined
    const pendingRefresh = new Promise<{
      agentId: string
      text: string
      truncated: boolean
    }>(resolve => {
      finishRefresh = resolve
    })
    mocks.output
      .mockResolvedValueOnce({
        agentId: 'terminal-1',
        text: 'Recent terminal output',
        truncated: false,
      })
      .mockReturnValue(pendingRefresh)
    render(<AgentTab resource={{ type: 'agent', agentId: 'terminal-1' }} />)
    expect(await screen.findByText('Recent terminal output')).toBeVisible()
    const terminal = screen.getByRole('region', { name: 'Live output' })
    act(() => terminal.focus())
    fireEvent.keyDown(terminal, { key: 'Enter' })
    const input = screen.getByRole('textbox', { name: 'Agent terminal input' })

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => expect(mocks.input).toHaveBeenCalledTimes(3))
    expect(mocks.output).toHaveBeenCalledTimes(2)

    finishRefresh?.({
      agentId: 'terminal-1',
      text: 'Updated terminal output',
      truncated: false,
    })
    expect(await screen.findByText('Updated terminal output')).toBeVisible()
    await waitFor(() => expect(mocks.output).toHaveBeenCalledTimes(3))
  })

  it('continues queued blocked input after a request fails', async () => {
    mocks.agent.status = 'blocked'
    mocks.input.mockRejectedValueOnce(new Error('socket closed'))
    render(<AgentTab resource={{ type: 'agent', agentId: 'terminal-1' }} />)
    expect(await screen.findByText('Recent terminal output')).toBeVisible()
    fireEvent.mouseUp(screen.getByRole('region', { name: 'Live output' }))
    const input = screen.getByRole('textbox', { name: 'Agent terminal input' })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(await screen.findByText('socket closed')).toBeVisible()

    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(mocks.input).toHaveBeenCalledTimes(2))
    expect(mocks.input).toHaveBeenLastCalledWith('terminal-1', {
      type: 'keys',
      keys: ['enter'],
    })
    await waitFor(() => expect(screen.queryByText('socket closed')).not.toBeInTheDocument())
  })

  it('focuses the selected Agent in Herdr', async () => {
    render(<AgentTab resource={{ type: 'agent', agentId: 'terminal-1' }} />)
    expect(await screen.findByText('Recent terminal output')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Focus in Herdr' }))
    await waitFor(() => expect(mocks.focus).toHaveBeenCalledWith('terminal-1'))
  })

  it('stops a Session-linked Agent and opens its History after removal', async () => {
    mocks.agent.session = {
      source: 'process',
      agent: 'codex',
      kind: 'id',
      value: 'session-1',
    }
    const onOpen = vi.fn()
    const props = {
      resource: { type: 'agent' as const, agentId: 'terminal-1' },
      projects: [{ name: 'herdr-roam', path: '/work/herdr-roam' }],
      onOpen,
    }
    const { rerender } = render(<AgentTab {...props} />)
    expect(await screen.findByText('Recent terminal output')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm stop' }))
    await waitFor(() => expect(mocks.stop).toHaveBeenCalledWith('terminal-1'))
    expect(onOpen).not.toHaveBeenCalled()

    mocks.present = false
    rerender(<AgentTab {...props} />)
    await waitFor(() =>
      expect(onOpen).toHaveBeenCalledWith({
        type: 'session',
        projectName: 'herdr-roam',
        provider: 'codex',
        sessionId: 'session-1',
      }),
    )
  })

  it('stops an unlinked Agent and keeps its last output visible', async () => {
    const onOpen = vi.fn()
    const props = {
      resource: { type: 'agent' as const, agentId: 'terminal-1' },
      onOpen,
    }
    const { rerender } = render(<AgentTab {...props} />)
    expect(await screen.findByText('Recent terminal output')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    expect(screen.queryByText(/Session history stays available/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm stop' }))
    await waitFor(() => expect(mocks.stop).toHaveBeenCalledWith('terminal-1'))

    mocks.present = false
    rerender(<AgentTab {...props} />)

    expect(await screen.findByText('stopped')).toBeVisible()
    expect(screen.getByText('Recent terminal output')).toBeVisible()
    expect(
      screen.getAllByText('This Agent has stopped and is no longer present in Herdr.')[0],
    ).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Stop' })).not.toBeInTheDocument()
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('keeps a linked Agent open when stopping fails', async () => {
    mocks.agent.session = {
      source: 'process',
      agent: 'codex',
      kind: 'id',
      value: 'session-1',
    }
    mocks.stop.mockRejectedValue(new Error('The pane could not be closed.'))
    const onOpen = vi.fn()
    render(
      <AgentTab
        resource={{ type: 'agent', agentId: 'terminal-1' }}
        projects={[{ name: 'herdr-roam', path: '/work/herdr-roam' }]}
        onOpen={onOpen}
      />,
    )
    expect(await screen.findByText('Recent terminal output')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm stop' }))

    expect(await screen.findByText('The pane could not be closed.')).toBeVisible()
    expect(onOpen).not.toHaveBeenCalled()
    expect(screen.getByRole('region', { name: 'Live output' })).toBeVisible()
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
      expect(mocks.prompt).toHaveBeenCalledWith('terminal-1', 'Review the change.', []),
    )
    expect(composer).toHaveValue('')
    expect(screen.getByText('Prompt submitted.')).toBeVisible()
  })

  it('keeps a draft when submission fails and accepts a follow-up while working', async () => {
    mocks.prompt.mockRejectedValueOnce(new Error('Prompt rejected'))
    const { unmount } = render(<AgentTab resource={{ type: 'agent', agentId: 'terminal-1' }} />)
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
    await waitFor(() => expect(mocks.prompt).toHaveBeenCalledTimes(2))
    expect(mocks.prompt).toHaveBeenLastCalledWith('terminal-1', 'Wait for this.', [])
  })

  it('rejects a Prompt larger than the shared UTF-8 byte limit', async () => {
    render(<AgentTab resource={{ type: 'agent', agentId: 'terminal-1' }} />)
    expect(await screen.findByText('Recent terminal output')).toBeVisible()
    const composer = screen.getByRole('textbox', { name: 'Send a Prompt' })
    fireEvent.change(composer, { target: { value: '界'.repeat(22_000) } })

    expect(screen.getByText('Prompt is too large (64 KB maximum).')).toBeVisible()
    fireEvent.keyDown(composer, { key: 'Enter' })
    expect(mocks.prompt).not.toHaveBeenCalled()
  })

  it('forwards Shift+Tab without changing the Prompt draft', async () => {
    render(<AgentTab resource={{ type: 'agent', agentId: 'terminal-1' }} />)
    expect(await screen.findByText('Recent terminal output')).toBeVisible()
    const composer = screen.getByRole('textbox', { name: 'Send a Prompt' })
    fireEvent.change(composer, { target: { value: 'Keep this draft.' } })
    fireEvent.keyDown(composer, { key: 'Tab', shiftKey: true })

    await waitFor(() =>
      expect(mocks.input).toHaveBeenCalledWith('terminal-1', {
        type: 'keys',
        keys: ['shift+tab'],
      }),
    )
    expect(composer).toHaveValue('Keep this draft.')
    expect(screen.getByText('Shift+Tab sent to the Agent.')).toBeVisible()
  })

  it('previews, removes, and submits pasted images', async () => {
    render(<AgentTab resource={{ type: 'agent', agentId: 'terminal-1' }} />)
    expect(await screen.findByText('Recent terminal output')).toBeVisible()
    const composer = screen.getByRole('textbox', { name: 'Send a Prompt' })
    const first = new File(['image'], 'first.png', { type: 'image/png' })
    fireEvent.paste(composer, { clipboardData: { files: [first] } })

    expect(screen.getByRole('img', { name: 'first.png' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Remove first.png' }))
    expect(screen.queryByRole('img', { name: 'first.png' })).not.toBeInTheDocument()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:screen')

    const second = new File(['image'], 'second.png', { type: 'image/png' })
    fireEvent.paste(composer, { clipboardData: { files: [second] } })
    fireEvent.change(composer, { target: { value: 'Inspect this.' } })
    fireEvent.keyDown(composer, { key: 'Enter' })

    await waitFor(() =>
      expect(mocks.prompt).toHaveBeenCalledWith('terminal-1', 'Inspect this.', [second]),
    )
    expect(composer).toHaveValue('')
    expect(screen.queryByRole('img', { name: 'second.png' })).not.toBeInTheDocument()
  })

  it('submits a pasted image without requiring Prompt text', async () => {
    render(<AgentTab resource={{ type: 'agent', agentId: 'terminal-1' }} />)
    expect(await screen.findByText('Recent terminal output')).toBeVisible()
    const composer = screen.getByRole('textbox', { name: 'Send a Prompt' })
    const image = new File(['image'], 'screen.png', { type: 'image/png' })
    fireEvent.paste(composer, { clipboardData: { files: [image] } })
    fireEvent.keyDown(composer, { key: 'Enter' })

    await waitFor(() => expect(mocks.prompt).toHaveBeenCalledWith('terminal-1', '', [image]))
    expect(screen.queryByRole('img', { name: 'screen.png' })).not.toBeInTheDocument()
  })
})

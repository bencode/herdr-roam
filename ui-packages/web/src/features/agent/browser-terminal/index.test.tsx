import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { connectBrowserTerminal } from './session'

const mocks = vi.hoisted(() => ({
  connect: vi.fn<typeof connectBrowserTerminal>(),
  disposeRenderer: vi.fn(),
  input: null as ((text: string) => void) | null,
}))

vi.mock('./session', () => ({ connectBrowserTerminal: mocks.connect }))
vi.mock('@xterm/addon-fit', () => ({
  FitAddon: class {
    proposeDimensions = () => ({ cols: 80, rows: 24 })
  },
}))
vi.mock('@xterm/xterm', () => ({
  Terminal: class {
    options = { disableStdin: true }
    cols = 80
    rows = 24
    parser = { registerOscHandler: () => ({ dispose: vi.fn() }) }
    loadAddon = vi.fn()
    open = (container: HTMLElement) => {
      container.textContent = 'Native terminal screen'
    }
    resize = vi.fn()
    focus = vi.fn()
    onData = (callback: (text: string) => void) => {
      mocks.input = callback
      return { dispose: vi.fn() }
    }
    onBinary = () => ({ dispose: vi.fn() })
    attachCustomKeyEventHandler = vi.fn()
    attachCustomWheelEventHandler = vi.fn()
    dispose = mocks.disposeRenderer
  },
}))

import { BrowserTerminal } from '.'

let controlsContainer: HTMLElement

const flushConnection = () =>
  act(() => {
    vi.runOnlyPendingTimers()
  })
const connection = () => {
  const value = mocks.connect.mock.results.at(-1)?.value
  if (!value) throw new Error('No terminal connection was created.')
  return value
}

describe('Agent terminal lifecycle', () => {
  beforeEach(() => {
    controlsContainer = document.createElement('header')
    document.body.append(controlsContainer)
    vi.useFakeTimers()
    vi.clearAllMocks()
    mocks.connect.mockImplementation(({ onState }) => {
      onState({ phase: 'connected', message: 'Connected' })
      return { dispose: vi.fn(), input: vi.fn(), resize: vi.fn(), scroll: vi.fn() }
    })
  })
  afterEach(() => {
    cleanup()
    controlsContainer.remove()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('connects on entry without takeover, releases on leaving, and reconnects on return', () => {
    const { unmount, rerender } = render(
      <BrowserTerminal controlsContainer={controlsContainer} agentId="terminal-1" available />,
    )
    flushConnection()
    expect(mocks.connect).toHaveBeenCalledOnce()
    expect(within(controlsContainer).getByText('Terminal: Connected')).toBeVisible()
    expect(
      within(screen.getByRole('region', { name: 'Agent terminal' })).queryByRole('status'),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Disconnect' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reconnect' })).not.toBeInTheDocument()
    expect(mocks.connect).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: 'terminal-1',
        connection: expect.objectContaining({ mode: 'control', takeover: false }),
      }),
    )
    const first = connection()
    rerender(
      <BrowserTerminal controlsContainer={controlsContainer} agentId="terminal-1" available />,
    )
    flushConnection()
    expect(mocks.connect).toHaveBeenCalledOnce()
    unmount()
    expect(first.dispose).toHaveBeenCalledOnce()
    render(<BrowserTerminal controlsContainer={controlsContainer} agentId="terminal-1" available />)
    flushConnection()
    expect(mocks.connect).toHaveBeenCalledTimes(2)
  })

  it('waits for initial availability but requires explicit recovery after disconnect or runtime loss', () => {
    const { rerender } = render(
      <BrowserTerminal
        controlsContainer={controlsContainer}
        agentId="terminal-1"
        available={false}
      />,
    )
    flushConnection()
    expect(mocks.connect).not.toHaveBeenCalled()
    rerender(
      <BrowserTerminal controlsContainer={controlsContainer} agentId="terminal-1" available />,
    )
    flushConnection()
    act(() =>
      mocks.connect.mock.calls
        .at(-1)?.[0]
        .onState({ phase: 'disconnected', message: 'Connection ended.' }),
    )
    rerender(
      <BrowserTerminal
        controlsContainer={controlsContainer}
        agentId="terminal-1"
        available={false}
      />,
    )
    rerender(
      <BrowserTerminal controlsContainer={controlsContainer} agentId="terminal-1" available />,
    )
    flushConnection()
    expect(mocks.connect).toHaveBeenCalledOnce()
    expect(screen.getByText('Native terminal screen')).toBeVisible()
    fireEvent.click(within(controlsContainer).getByRole('button', { name: 'Reconnect' }))
    expect(mocks.connect).toHaveBeenCalledTimes(2)
    const second = connection()
    rerender(
      <BrowserTerminal
        controlsContainer={controlsContainer}
        agentId="terminal-1"
        available={false}
      />,
    )
    expect(second.dispose).toHaveBeenCalledOnce()
    rerender(
      <BrowserTerminal controlsContainer={controlsContainer} agentId="terminal-1" available />,
    )
    flushConnection()
    expect(mocks.connect).toHaveBeenCalledTimes(2)
  })

  it.each(['busy', 'error'] as const)(
    'does not loop on %s; observation and takeover remain explicit',
    phase => {
      mocks.connect.mockImplementationOnce(({ onState }) => {
        onState({ phase, message: 'Connection needs attention.' })
        return { dispose: vi.fn(), input: vi.fn(), resize: vi.fn(), scroll: vi.fn() }
      })
      const { rerender } = render(
        <BrowserTerminal controlsContainer={controlsContainer} agentId="terminal-1" available />,
      )
      flushConnection()
      rerender(
        <BrowserTerminal controlsContainer={controlsContainer} agentId="terminal-1" available />,
      )
      flushConnection()
      expect(mocks.connect).toHaveBeenCalledOnce()
      if (phase === 'busy') {
        fireEvent.click(screen.getByRole('button', { name: 'Observe' }))
        expect(mocks.connect).toHaveBeenLastCalledWith(
          expect.objectContaining({
            connection: expect.objectContaining({ mode: 'observe', takeover: false }),
          }),
        )
        act(() =>
          mocks.connect.mock.calls
            .at(-1)?.[0]
            .onState({ phase: 'busy', message: 'Controlled elsewhere.' }),
        )
        fireEvent.click(screen.getByRole('button', { name: 'Take over' }))
        expect(mocks.connect).toHaveBeenLastCalledWith(
          expect.objectContaining({
            connection: expect.objectContaining({ mode: 'control', takeover: true }),
          }),
        )
      }
    },
  )

  it('forwards local image paths unchanged as native text', () => {
    render(<BrowserTerminal controlsContainer={controlsContainer} agentId="terminal-1" available />)
    flushConnection()
    const path = '"/private/tmp/截图 folder/example image.png"'
    mocks.input?.(path)
    const bytes = vi.mocked(connection().input).mock.calls[0]?.[0]
    expect(new TextDecoder().decode(bytes)).toBe(path)
  })

  it('does not leak connections during Strict Mode effect setup and cleanup', () => {
    const { unmount } = render(
      <StrictMode>
        <BrowserTerminal controlsContainer={controlsContainer} agentId="terminal-1" available />
      </StrictMode>,
    )
    flushConnection()
    expect(mocks.connect).toHaveBeenCalledOnce()
    const current = connection()
    unmount()
    expect(current.dispose).toHaveBeenCalledOnce()
  })
})

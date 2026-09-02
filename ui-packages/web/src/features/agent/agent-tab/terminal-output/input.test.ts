import type { AgentInputKey, AgentInputRequest } from '@herdr-roam/shared'
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { terminalInputKey, useTerminalInputBridge } from './input'

const keyEvent = (key: string, overrides: Partial<Parameters<typeof terminalInputKey>[0]> = {}) =>
  terminalInputKey({
    key,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    ...overrides,
  })

describe('terminalInputKey', () => {
  it.each<[string, AgentInputKey]>([
    ['ArrowUp', 'up'],
    ['ArrowDown', 'down'],
    ['ArrowLeft', 'left'],
    ['ArrowRight', 'right'],
    ['Enter', 'enter'],
    ['Escape', 'esc'],
    ['Tab', 'tab'],
    ['Backspace', 'backspace'],
    ['Delete', 'delete'],
    ['Home', 'home'],
    ['End', 'end'],
  ])('maps %s to %s', (keyboardKey, inputKey) => {
    expect(keyEvent(keyboardKey)).toBe(inputKey)
  })

  it('maps only the supported Shift+Tab chord', () => {
    expect(keyEvent('Tab', { shiftKey: true })).toBe('shift+tab')
    expect(keyEvent('Enter', { shiftKey: true })).toBeNull()
    expect(keyEvent('Shift', { shiftKey: true })).toBeNull()
  })

  it('leaves browser and system shortcuts untouched', () => {
    expect(keyEvent('F6')).toBeNull()
    expect(keyEvent('ArrowDown', { altKey: true })).toBeNull()
    expect(keyEvent('ArrowDown', { ctrlKey: true })).toBeNull()
    expect(keyEvent('ArrowDown', { metaKey: true })).toBeNull()
  })
})

describe('useTerminalInputBridge', () => {
  it('rejects oversized UTF-8 text before it enters the input queue', () => {
    const sendInput = vi.fn()
    const onInputError = vi.fn()
    const { result } = renderHook(() =>
      useTerminalInputBridge({
        agentId: 'terminal-1',
        canInput: true,
        sendInput,
        onInputAccepted: vi.fn(),
        onInputError,
      }),
    )

    act(() => result.current.queueInput({ type: 'text', text: '界'.repeat(22_000) }))

    expect(sendInput).not.toHaveBeenCalled()
    expect(onInputError).toHaveBeenCalledWith('Terminal input is too large (64 KB maximum).')
  })

  it('keeps input ordered without waiting for accepted-output work', async () => {
    let finishFirst: (() => void) | undefined
    const firstRequest = new Promise<void>(resolve => {
      finishFirst = resolve
    })
    const acceptedWork = new Promise<void>(() => undefined)
    const sendInput = vi
      .fn<(agentId: string, request: AgentInputRequest) => Promise<unknown>>()
      .mockReturnValueOnce(firstRequest)
      .mockResolvedValueOnce(undefined)
    const onInputAccepted = vi.fn(() => acceptedWork)
    const onInputError = vi.fn()
    const { result } = renderHook(() =>
      useTerminalInputBridge({
        agentId: 'terminal-1',
        canInput: true,
        sendInput,
        onInputAccepted,
        onInputError,
      }),
    )

    act(() => {
      result.current.queueInput({ type: 'keys', keys: ['down'] })
      result.current.queueInput({ type: 'keys', keys: ['enter'] })
    })
    await waitFor(() => expect(sendInput).toHaveBeenCalledTimes(1))

    finishFirst?.()
    await waitFor(() => expect(sendInput).toHaveBeenCalledTimes(2))
    expect(sendInput.mock.calls).toEqual([
      ['terminal-1', { type: 'keys', keys: ['down'] }],
      ['terminal-1', { type: 'keys', keys: ['enter'] }],
    ])
    expect(onInputAccepted).toHaveBeenCalledTimes(2)
  })

  it('reports a failed request and continues with the next input', async () => {
    const sendInput = vi
      .fn<(agentId: string, request: AgentInputRequest) => Promise<unknown>>()
      .mockRejectedValueOnce(new Error('socket closed'))
      .mockResolvedValueOnce(undefined)
    const onInputAccepted = vi.fn()
    const onInputError = vi.fn()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { result } = renderHook(() =>
      useTerminalInputBridge({
        agentId: 'terminal-1',
        canInput: true,
        sendInput,
        onInputAccepted,
        onInputError,
      }),
    )

    act(() => {
      result.current.queueInput({ type: 'keys', keys: ['down'] })
      result.current.queueInput({ type: 'keys', keys: ['enter'] })
    })

    await waitFor(() => expect(sendInput).toHaveBeenCalledTimes(2))
    expect(consoleError).toHaveBeenCalledWith(
      'Agent terminal input failed',
      expect.objectContaining({ message: 'socket closed' }),
    )
    expect(onInputError).toHaveBeenCalledWith('socket closed')
    expect(onInputAccepted).toHaveBeenCalledTimes(1)
    consoleError.mockRestore()
  })
})

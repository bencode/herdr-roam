import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useProjectSessions, useSessionData } from './use-session-data'

const mocks = vi.hoisted(() => ({
  catalog: vi.fn(),
  page: vi.fn(),
  delta: vi.fn(),
}))

vi.mock('./client', () => ({
  fetchProjectSessions: mocks.catalog,
  fetchSessionPage: mocks.page,
  fetchSessionDelta: mocks.delta,
  SessionClientError: class SessionClientError extends Error {},
}))

const summary = {
  id: 'session-1',
  provider: 'codex' as const,
  title: 'Review release',
  cwd: '/work/herdr-roam',
  createdAt: null,
  updatedAt: '2026-09-01T09:00:00.000Z',
}

beforeEach(() => {
  mocks.catalog.mockReset()
  mocks.page.mockReset()
  mocks.delta.mockReset()
})

afterEach(() => vi.useRealTimers())

describe('Session data hooks', () => {
  it('debounces server-side catalog search', async () => {
    vi.useFakeTimers()
    mocks.catalog.mockResolvedValue({ items: [summary], total: 1, nextCursor: null })
    renderHook(() => useProjectSessions('herdr-roam', { query: 'review' }))

    await act(async () => vi.advanceTimersByTime(299))
    expect(mocks.catalog).not.toHaveBeenCalled()
    await act(async () => vi.advanceTimersByTime(1))
    expect(mocks.catalog).toHaveBeenCalledWith(
      'herdr-roam',
      expect.objectContaining({ query: 'review', limit: 50 }),
    )
  })

  it('merges bounded live deltas into the latest history page', async () => {
    vi.useFakeTimers()
    mocks.page.mockResolvedValue({
      ...summary,
      mode: 'page',
      entries: [
        {
          kind: 'activity',
          id: 'call-1',
          name: 'read_file',
          status: 'pending',
          input: null,
          output: null,
          createdAt: null,
        },
      ],
      olderCursor: null,
      tailCursor: 'tail-1',
      atLatest: true,
    })
    mocks.delta.mockResolvedValue({
      mode: 'delta',
      entries: [
        {
          kind: 'message',
          id: 'message-2',
          role: 'assistant',
          text: 'Done.',
          createdAt: null,
          attachments: [],
        },
      ],
      activityUpdates: [{ id: 'call-1', status: 'completed', output: 'contents' }],
      tailCursor: 'tail-2',
      caughtUp: true,
    })

    const { result } = renderHook(() => useSessionData('herdr-roam', 'codex', 'session-1', true))
    await act(async () => Promise.resolve())
    expect(result.current.value?.tailCursor).toBe('tail-1')
    await act(async () => vi.advanceTimersByTimeAsync(1_000))
    expect(result.current.value?.tailCursor).toBe('tail-2')
    expect(result.current.value?.entries).toEqual([
      expect.objectContaining({ id: 'call-1', status: 'completed', output: 'contents' }),
      expect.objectContaining({ id: 'message-2', text: 'Done.' }),
    ])
  })
})

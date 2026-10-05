import type { AgentStatus, AgentSummary } from '@herdr-roam/shared'
import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useBlockedNotifications, writeBlockedNotifications } from './blocked-notifications'

const agent = (status: AgentStatus): AgentSummary => ({
  id: 'term-1',
  name: 'codex-roost',
  provider: 'codex',
  status,
  cwd: '/work/roost',
  attachTarget: 'w1:p1',
  session: null,
})

const shown = vi.fn()

class FakeNotification {
  static permission = 'granted'
  onclick: (() => void) | null = null
  constructor(title: string, options: NotificationOptions) {
    shown(title, options)
  }
  close() {}
}

const render = (initial: AgentStatus) =>
  renderHook(({ status }) => useBlockedNotifications([agent(status)], () => undefined), {
    initialProps: { status: initial },
  })

describe('blocked notifications', () => {
  beforeEach(() => {
    vi.stubGlobal('Notification', FakeNotification)
    writeBlockedNotifications(true)
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    shown.mockReset()
    localStorage.clear()
  })

  it('notifies once when a background Agent starts waiting', () => {
    const { rerender } = render('working')
    rerender({ status: 'blocked' })
    rerender({ status: 'blocked' })
    expect(shown).toHaveBeenCalledTimes(1)
    expect(shown).toHaveBeenCalledWith('codex-roost is waiting for you', expect.anything())
  })

  it('stays quiet for Agents already blocked on load', () => {
    const { rerender } = render('blocked')
    rerender({ status: 'blocked' })
    expect(shown).not.toHaveBeenCalled()
  })

  it('stays quiet while Roam is in the foreground', () => {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    const { rerender } = render('working')
    rerender({ status: 'blocked' })
    expect(shown).not.toHaveBeenCalled()
  })
})

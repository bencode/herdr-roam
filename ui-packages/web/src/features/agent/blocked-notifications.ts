import type { AgentStatus, AgentSummary } from '@herdr-roam/shared'
import { useEffect, useRef } from 'react'
import { agentDirectoryLabel, agentProviderLabel } from './presentation'

const STORAGE_KEY = 'herdr-roam:notify-blocked'

export const blockedNotificationsSupported = (): boolean => 'Notification' in globalThis

export const readBlockedNotifications = (): boolean => {
  try {
    return globalThis.localStorage.getItem(STORAGE_KEY) === 'true'
  } catch (error) {
    console.error('Blocked notification preference could not be read', error)
    return false
  }
}

export const writeBlockedNotifications = (enabled: boolean): void => {
  try {
    globalThis.localStorage.setItem(STORAGE_KEY, String(enabled))
  } catch (error) {
    console.error('Blocked notification preference could not be saved', error)
  }
}

const notify = (agent: AgentSummary, onOpen: (agentId: string) => void) => {
  const notification = new Notification(`${agent.name} is waiting for you`, {
    body: [agentProviderLabel(agent.provider), agentDirectoryLabel(agent.cwd)]
      .filter(value => value !== null)
      .join(' · '),
    tag: agent.id,
  })
  notification.onclick = () => {
    window.focus()
    onOpen(agent.id)
    notification.close()
  }
}

/** Raises a system notification when an Agent starts waiting while Roam is in the background. */
export const useBlockedNotifications = (
  agents: readonly AgentSummary[],
  onOpen: (agentId: string) => void,
): void => {
  const previous = useRef<ReadonlyMap<string, AgentStatus> | null>(null)

  useEffect(() => {
    const before = previous.current
    previous.current = new Map(agents.map(agent => [agent.id, agent.status]))
    if (!before || !blockedNotificationsSupported()) return
    if (Notification.permission !== 'granted' || document.visibilityState === 'visible') return
    if (!readBlockedNotifications()) return
    agents
      .filter(agent => agent.status === 'blocked' && before.get(agent.id) !== 'blocked')
      .forEach(agent => {
        notify(agent, onOpen)
      })
  }, [agents, onOpen])
}

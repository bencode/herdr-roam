import type { AgentRuntimeSnapshot } from '@herdr-roam/shared'
import { AGENT_REFRESH_MS, RECONNECT_DELAYS_MS } from '../config.js'
import {
  discoverHerdr,
  HerdrDiscoveryError,
  type HerdrDiscovery,
} from '../herdr/discovery.js'
import { createHerdrClient, type HerdrClient } from '../herdr/client.js'
import { mapAgents, mapObservedDirectories, sameAgentSnapshot } from './mapper.js'

type Listener = (snapshot: AgentRuntimeSnapshot) => void

export type AgentRuntime = {
  readonly start: () => void
  readonly stop: () => void
  readonly snapshot: () => AgentRuntimeSnapshot
  readonly client: () => HerdrClient | null
  readonly subscribe: (listener: Listener) => () => void
}

type RuntimeState = {
  current: AgentRuntimeSnapshot
  client: HerdrClient | null
  discovery: HerdrDiscovery | null
  unsubscribeHerdr: (() => void) | null
  reconnectTimer: NodeJS.Timeout | null
  refreshTimer: NodeJS.Timeout | null
  reconnectAttempt: number
  connectionId: number
  running: boolean
  refreshing: boolean
  refreshPending: boolean
}

const initialSnapshot = (): AgentRuntimeSnapshot => ({
  source: {
    state: 'unavailable',
    code: 'herdr_unavailable',
    message: 'Connecting to the default Herdr server.',
  },
  stale: false,
  items: [],
  observedDirectories: [],
})

const discoveryFailure = (error: unknown, hasItems: boolean): AgentRuntimeSnapshot['source'] => {
  const state = hasItems ? 'reconnecting' : 'unavailable'
  if (error instanceof HerdrDiscoveryError) {
    return { state, code: error.code, message: error.message }
  }
  return {
    state,
    code: 'herdr_unavailable',
    message: error instanceof Error ? error.message : 'The Herdr server is unavailable.',
  }
}

export const createAgentRuntime = (): AgentRuntime => {
  const listeners = new Set<Listener>()
  const state: RuntimeState = {
    current: initialSnapshot(),
    client: null,
    discovery: null,
    unsubscribeHerdr: null,
    reconnectTimer: null,
    refreshTimer: null,
    reconnectAttempt: 0,
    connectionId: 0,
    running: false,
    refreshing: false,
    refreshPending: false,
  }

  const setSnapshot = (snapshot: AgentRuntimeSnapshot) => {
    if (sameAgentSnapshot(state.current, snapshot)) return
    state.current = snapshot
    listeners.forEach(listener => {
      listener(snapshot)
    })
  }

  const refresh = async (connectionId: number): Promise<void> => {
    const { client, discovery } = state
    if (!client || !discovery || connectionId !== state.connectionId) return
    if (state.refreshing) {
      state.refreshPending = true
      return
    }
    state.refreshing = true
    try {
      const [agents, panes] = await Promise.all([client.listAgents(), client.listPanes()])
      const items = mapAgents(agents)
      if (connectionId !== state.connectionId) return
      setSnapshot({
        source: { state: 'connected', version: discovery.version, protocol: discovery.protocol },
        stale: false,
        items,
        observedDirectories: mapObservedDirectories(agents, panes),
      })
    } finally {
      state.refreshing = false
      if (state.refreshPending && connectionId === state.connectionId) {
        state.refreshPending = false
        queueRefresh(connectionId)
      }
    }
  }

  const queueRefresh = (connectionId: number) => {
    if (connectionId !== state.connectionId) return
    if (state.refreshing) {
      state.refreshPending = true
      return
    }
    void refresh(connectionId).catch(error => disconnect(error, connectionId))
  }

  const disconnect = (error: unknown, connectionId: number) => {
    if (!state.running || connectionId !== state.connectionId) return
    console.error('Herdr connection failed', error)
    state.connectionId += 1
    state.unsubscribeHerdr?.()
    if (state.refreshTimer) clearInterval(state.refreshTimer)
    state.unsubscribeHerdr = null
    state.refreshTimer = null
    state.client = null
    state.discovery = null
    const items = state.current.items
    const observedDirectories = state.current.observedDirectories
    const hasSnapshot = items.length > 0 || observedDirectories.length > 0
    setSnapshot({
      source: discoveryFailure(error, hasSnapshot),
      stale: hasSnapshot,
      items,
      observedDirectories,
    })
    const index = Math.min(state.reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)
    const delay = RECONNECT_DELAYS_MS[index] ?? RECONNECT_DELAYS_MS.at(-1) ?? 5_000
    state.reconnectAttempt += 1
    state.reconnectTimer = setTimeout(() => {
      state.reconnectTimer = null
      if (state.running) void connect()
    }, delay)
  }

  const connect = async (): Promise<void> => {
    const connectionId = ++state.connectionId
    try {
      const discovery = await discoverHerdr()
      if (!state.running || connectionId !== state.connectionId) return
      const client = createHerdrClient(discovery.socketPath)
      state.client = client
      state.discovery = discovery
      state.unsubscribeHerdr = await client.subscribe(
        () => queueRefresh(connectionId),
        error => disconnect(error, connectionId),
      )
      await refresh(connectionId)
      state.refreshTimer = setInterval(() => queueRefresh(connectionId), AGENT_REFRESH_MS)
      state.reconnectAttempt = 0
    } catch (error) {
      disconnect(error, connectionId)
    }
  }

  return {
    start: () => {
      if (state.running) return
      state.running = true
      void connect()
    },
    stop: () => {
      state.running = false
      state.connectionId += 1
      if (state.reconnectTimer) clearTimeout(state.reconnectTimer)
      if (state.refreshTimer) clearInterval(state.refreshTimer)
      state.reconnectTimer = null
      state.refreshTimer = null
      state.unsubscribeHerdr?.()
      state.unsubscribeHerdr = null
      state.client = null
      state.discovery = null
    },
    snapshot: () => state.current,
    client: () => state.client,
    subscribe: listener => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

import type { AgentRuntimeSnapshot, AgentSummary } from '@herdr-roam/shared'
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { AgentClientError, fetchAgentSnapshot, subscribeAgentSnapshots } from '../client'

type AgentRuntimeValue = {
  readonly snapshot: AgentRuntimeSnapshot
  readonly transportError: AgentClientError | null
  readonly agentById: (agentId: string) => AgentSummary | undefined
  readonly registerStartedAgent: (agent: AgentSummary) => void
}

const initialSnapshot: AgentRuntimeSnapshot = {
  source: {
    state: 'unavailable',
    code: 'herdr_unavailable',
    message: 'Connecting to Herdr Roam.',
  },
  stale: false,
  items: [],
}

const AgentRuntimeContext = createContext<AgentRuntimeValue | null>(null)

export const AgentRuntimeProvider = ({ children }: { readonly children: ReactNode }) => {
  const [snapshot, setSnapshot] = useState(initialSnapshot)
  const [transportError, setTransportError] = useState<AgentClientError | null>(null)
  const registerStartedAgent = useCallback((agent: AgentSummary) => {
    setSnapshot(current =>
      current.items.some(item => item.id === agent.id)
        ? current
        : { ...current, items: [...current.items, agent] },
    )
  }, [])

  useEffect(() => {
    let active = true
    let unsubscribe: (() => void) | null = null

    const connect = async () => {
      try {
        const initial = await fetchAgentSnapshot()
        if (!active) return
        setSnapshot(initial)
        setTransportError(null)
      } catch (error) {
        if (!active) return
        console.error('Agent snapshot request failed', error)
        setTransportError(
          error instanceof AgentClientError
            ? error
            : new AgentClientError(
                'network_error',
                'The Agent snapshot could not be loaded.',
                null,
                { cause: error },
              ),
        )
      }
      if (!active) return
      unsubscribe = subscribeAgentSnapshots(
        next => {
          setSnapshot(next)
          setTransportError(null)
        },
        error => {
          console.error('Agent event stream failed', error)
          setTransportError(error)
        },
      )
    }

    void connect()
    return () => {
      active = false
      unsubscribe?.()
    }
  }, [])

  const value = useMemo<AgentRuntimeValue>(
    () => ({
      snapshot,
      transportError,
      agentById: agentId => snapshot.items.find(agent => agent.id === agentId),
      registerStartedAgent,
    }),
    [snapshot, transportError, registerStartedAgent],
  )

  return <AgentRuntimeContext.Provider value={value}>{children}</AgentRuntimeContext.Provider>
}

export const useAgentRuntime = (): AgentRuntimeValue => {
  const value = useContext(AgentRuntimeContext)
  if (!value) throw new Error('useAgentRuntime must be used inside AgentRuntimeProvider')
  return value
}

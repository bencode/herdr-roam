import { create } from 'zustand'

const STORAGE_KEY = 'herdr-roam.assistant.v1'

export type AssistantSnapshot = {
  readonly version: 1
  readonly open: boolean
  readonly maximized: boolean
  readonly agentIds: readonly string[]
  readonly activeAgentId: string | null
}

type AssistantStore = AssistantSnapshot & {
  readonly openAgent: (agentId: string) => void
  readonly activate: (agentId: string) => void
  readonly closeAgent: (agentId: string) => void
  readonly setOpen: (open: boolean) => void
  readonly setMaximized: (maximized: boolean) => void
  // The active tab stays so a stopped Agent can show its final state and open its Session.
  readonly prune: (liveAgentIds: ReadonlySet<string>) => void
}

const defaultSnapshot: AssistantSnapshot = {
  version: 1,
  open: false,
  maximized: false,
  agentIds: [],
  activeAgentId: null,
}

const parseSnapshot = (value: unknown): AssistantSnapshot | null => {
  if (typeof value !== 'object' || value === null) return null
  const record = value as Record<string, unknown>
  if (
    record.version !== 1 ||
    typeof record.open !== 'boolean' ||
    typeof record.maximized !== 'boolean' ||
    !Array.isArray(record.agentIds) ||
    !record.agentIds.every(id => typeof id === 'string')
  ) {
    return null
  }
  const agentIds: readonly string[] = record.agentIds
  const activeAgentId =
    typeof record.activeAgentId === 'string' && agentIds.includes(record.activeAgentId)
      ? record.activeAgentId
      : null
  return { version: 1, open: record.open, maximized: record.maximized, agentIds, activeAgentId }
}

const readSnapshot = (): AssistantSnapshot => {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY)
    if (!raw) return defaultSnapshot
    const parsed = parseSnapshot(JSON.parse(raw))
    if (parsed) return parsed
    console.error('assistant state is invalid; using defaults')
  } catch (error) {
    console.error('assistant state read failed', error)
  }
  return defaultSnapshot
}

const persist = (snapshot: AssistantSnapshot): void => {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  } catch (error) {
    console.error('assistant state write failed', error)
  }
}

const snapshotOf = (state: AssistantSnapshot): AssistantSnapshot => ({
  version: 1,
  open: state.open,
  maximized: state.maximized,
  agentIds: state.agentIds,
  activeAgentId: state.activeAgentId,
})

const neighbourOf = (agentIds: readonly string[], agentId: string): string | null => {
  const index = agentIds.indexOf(agentId)
  return agentIds[index + 1] ?? agentIds[index - 1] ?? null
}

export const useAssistantStore = create<AssistantStore>((set, get) => {
  const update = (change: Partial<AssistantSnapshot>) => {
    const next = { ...snapshotOf(get()), ...change }
    set(next)
    persist(next)
  }

  return {
    ...readSnapshot(),
    openAgent: agentId => {
      const { agentIds } = get()
      update({
        open: true,
        agentIds: agentIds.includes(agentId) ? agentIds : [...agentIds, agentId],
        activeAgentId: agentId,
      })
    },
    activate: agentId => {
      if (get().agentIds.includes(agentId)) update({ activeAgentId: agentId })
    },
    closeAgent: agentId => {
      const { agentIds, activeAgentId } = get()
      update({
        agentIds: agentIds.filter(id => id !== agentId),
        activeAgentId: activeAgentId === agentId ? neighbourOf(agentIds, agentId) : activeAgentId,
      })
    },
    setOpen: open => {
      if (get().open !== open) update({ open, maximized: open && get().maximized })
    },
    setMaximized: maximized => {
      if (get().maximized !== maximized) update({ maximized, open: get().open || maximized })
    },
    prune: liveAgentIds => {
      const { agentIds, activeAgentId } = get()
      const kept = agentIds.filter(id => id === activeAgentId || liveAgentIds.has(id))
      if (kept.length !== agentIds.length) update({ agentIds: kept })
    },
  }
})

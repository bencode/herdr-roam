import { create } from 'zustand'
import { isResourceRef, type ResourceRef, resourceKey } from './resource'

const STORAGE_KEY = 'herdr-roam.workbench.v2'
const DEFAULT_PROJECT = 'herdr-roam'

export type WorkbenchSnapshot = {
  readonly version: 2
  readonly activeProjectName: string
  readonly tabs: readonly ResourceRef[]
  readonly lastActive: ResourceRef | null
}

type WorkbenchStore = WorkbenchSnapshot & {
  readonly open: (resource: ResourceRef) => void
  readonly close: (resource: ResourceRef) => ResourceRef | null
  readonly showWorkbench: () => void
  readonly setActiveProject: (projectName: string) => void
}

export const defaultWorkbenchSnapshot: WorkbenchSnapshot = {
  version: 2,
  activeProjectName: DEFAULT_PROJECT,
  tabs: [],
  lastActive: null,
}

const snapshotRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null

const parseSnapshot = (value: unknown): WorkbenchSnapshot | null => {
  const record = snapshotRecord(value)
  if (record?.version !== 2 || typeof record.activeProjectName !== 'string') return null
  if (!Array.isArray(record.tabs) || !record.tabs.every(isResourceRef)) return null
  if (record.lastActive !== null && !isResourceRef(record.lastActive)) return null
  return {
    version: 2,
    activeProjectName: record.activeProjectName,
    tabs: record.tabs,
    lastActive: record.lastActive,
  }
}

const readSnapshot = (): WorkbenchSnapshot => {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY)
    if (!raw) return defaultWorkbenchSnapshot
    const parsed = parseSnapshot(JSON.parse(raw))
    if (parsed) return parsed
    console.error('workbench state is invalid; using defaults')
  } catch (error) {
    console.error('workbench state read failed', error)
  }
  return defaultWorkbenchSnapshot
}

const persist = (snapshot: WorkbenchSnapshot): void => {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  } catch (error) {
    console.error('workbench state write failed', error)
  }
}

const nextAfterClose = (tabs: readonly ResourceRef[], closing: ResourceRef): ResourceRef | null => {
  const index = tabs.findIndex(tab => resourceKey(tab) === resourceKey(closing))
  if (index < 0) return null
  const remaining = tabs.filter(tab => resourceKey(tab) !== resourceKey(closing))
  return remaining[index] ?? remaining[index - 1] ?? null
}

const initial = readSnapshot()

export const useWorkbenchStore = create<WorkbenchStore>((set, get) => ({
  ...initial,
  open: resource => {
    const current = get()
    const tabs = current.tabs.some(tab => resourceKey(tab) === resourceKey(resource))
      ? current.tabs
      : [...current.tabs, resource]
    const next = {
      version: 2 as const,
      activeProjectName: current.activeProjectName,
      tabs,
      lastActive: resource,
    }
    set(next)
    persist(next)
  },
  close: resource => {
    const current = get()
    const candidate = nextAfterClose(current.tabs, resource)
    const tabs = current.tabs.filter(tab => resourceKey(tab) !== resourceKey(resource))
    const lastActive =
      current.lastActive && resourceKey(current.lastActive) === resourceKey(resource)
        ? candidate
        : current.lastActive
    const next = {
      version: 2 as const,
      activeProjectName: current.activeProjectName,
      tabs,
      lastActive,
    }
    set(next)
    persist(next)
    return candidate
  },
  showWorkbench: () => {
    const current = get()
    const next = { ...current, lastActive: null }
    set({ lastActive: null })
    persist(next)
  },
  setActiveProject: activeProjectName => {
    const current = get()
    const next = { ...current, activeProjectName }
    set({ activeProjectName })
    persist(next)
  },
}))

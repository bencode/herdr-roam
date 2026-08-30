import { create } from 'zustand'
import { type GlobalDimension, isResourceRef, type ResourceRef, resourceKey } from './resource'
import {
  activityRootPath,
  canonicalPath,
  parseResourcePath,
  resourcePath,
  routeDimension,
} from './resource-route'

const STORAGE_KEY = 'herdr-roam.workbench.v3'
const LEGACY_STORAGE_KEY = 'herdr-roam.workbench.v2'
const DEFAULT_PROJECT = 'herdr-roam'

export type ActivityPaths = Readonly<Record<GlobalDimension, string>>

export type WorkbenchSnapshot = {
  readonly version: 3
  readonly activeProjectName: string
  readonly tabs: readonly ResourceRef[]
  readonly lastActive: ResourceRef | null
  readonly lastActivity: GlobalDimension
  readonly activityPaths: ActivityPaths
}

type WorkbenchStore = WorkbenchSnapshot & {
  readonly open: (resource: ResourceRef) => void
  readonly close: (resource: ResourceRef) => ResourceRef | null
  readonly rememberActivity: (dimension: GlobalDimension, pathname: string) => void
  readonly showWorkbench: () => void
  readonly setActiveProject: (projectName: string) => void
}

const defaultActivityPaths = (projectName: string): ActivityPaths => ({
  projects: activityRootPath('projects', projectName),
  agents: activityRootPath('agents', projectName),
  skills: activityRootPath('skills', projectName),
})

const defaultSnapshot = (projectName: string): WorkbenchSnapshot => ({
  version: 3,
  activeProjectName: projectName,
  tabs: [],
  lastActive: null,
  lastActivity: 'projects',
  activityPaths: defaultActivityPaths(projectName),
})

export const defaultWorkbenchSnapshot = defaultSnapshot(DEFAULT_PROJECT)

const snapshotRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null

const dimensions: readonly GlobalDimension[] = ['projects', 'agents', 'skills']

const isDimension = (value: unknown): value is GlobalDimension =>
  typeof value === 'string' && dimensions.some(dimension => dimension === value)

const validActivityPath = (value: unknown, dimension: GlobalDimension): string | null => {
  if (typeof value !== 'string') return null
  const target = parseResourcePath(value)
  if (routeDimension(target) !== dimension) return null
  return canonicalPath(target)
}

const parseSnapshot = (value: unknown): WorkbenchSnapshot | null => {
  const record = snapshotRecord(value)
  if (record?.version !== 3 || typeof record.activeProjectName !== 'string') return null
  if (!Array.isArray(record.tabs) || !record.tabs.every(isResourceRef)) return null
  if (record.lastActive !== null && !isResourceRef(record.lastActive)) return null
  const storedPaths = snapshotRecord(record.activityPaths)
  const defaults = defaultActivityPaths(record.activeProjectName)
  const activityPaths: ActivityPaths = {
    projects: validActivityPath(storedPaths?.projects, 'projects') ?? defaults.projects,
    agents: validActivityPath(storedPaths?.agents, 'agents') ?? defaults.agents,
    skills: validActivityPath(storedPaths?.skills, 'skills') ?? defaults.skills,
  }
  return {
    version: 3,
    activeProjectName: record.activeProjectName,
    tabs: record.tabs,
    lastActive: record.lastActive,
    lastActivity: isDimension(record.lastActivity) ? record.lastActivity : 'projects',
    activityPaths,
  }
}

const migrateSnapshot = (value: unknown): WorkbenchSnapshot | null => {
  const record = snapshotRecord(value)
  if (record?.version !== 2 || typeof record.activeProjectName !== 'string') return null
  if (!Array.isArray(record.tabs) || !record.tabs.every(isResourceRef)) return null
  if (record.lastActive !== null && !isResourceRef(record.lastActive)) return null
  const migrated = {
    ...defaultSnapshot(record.activeProjectName),
    tabs: record.tabs,
    lastActive: record.lastActive,
  }
  if (!record.lastActive) return migrated
  const pathname = resourcePath(record.lastActive)
  const dimension = routeDimension(parseResourcePath(pathname))
  if (!dimension) return migrated
  return {
    ...migrated,
    lastActivity: dimension,
    activityPaths: { ...migrated.activityPaths, [dimension]: pathname },
  }
}

const persist = (snapshot: WorkbenchSnapshot): void => {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  } catch (error) {
    console.error('workbench state write failed', error)
  }
}

const readSnapshot = (): WorkbenchSnapshot => {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = parseSnapshot(JSON.parse(raw))
      if (parsed) return parsed
      console.error('workbench state is invalid; using defaults')
      return defaultWorkbenchSnapshot
    }
    const legacyRaw = globalThis.localStorage?.getItem(LEGACY_STORAGE_KEY)
    if (!legacyRaw) return defaultWorkbenchSnapshot
    const migrated = migrateSnapshot(JSON.parse(legacyRaw))
    if (migrated) {
      persist(migrated)
      return migrated
    }
    console.error('workbench state is invalid; using defaults')
  } catch (error) {
    console.error('workbench state read failed', error)
  }
  return defaultWorkbenchSnapshot
}

const nextAfterClose = (tabs: readonly ResourceRef[], closing: ResourceRef): ResourceRef | null => {
  const index = tabs.findIndex(tab => resourceKey(tab) === resourceKey(closing))
  if (index < 0) return null
  const remaining = tabs.filter(tab => resourceKey(tab) !== resourceKey(closing))
  return remaining[index] ?? remaining[index - 1] ?? null
}

const snapshotOf = (state: WorkbenchSnapshot): WorkbenchSnapshot => ({
  version: 3,
  activeProjectName: state.activeProjectName,
  tabs: state.tabs,
  lastActive: state.lastActive,
  lastActivity: state.lastActivity,
  activityPaths: state.activityPaths,
})

const initial = readSnapshot()

export const useWorkbenchStore = create<WorkbenchStore>((set, get) => ({
  ...initial,
  open: resource => {
    const current = get()
    const tabs = current.tabs.some(tab => resourceKey(tab) === resourceKey(resource))
      ? current.tabs
      : [...current.tabs, resource]
    const next = {
      ...snapshotOf(current),
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
      ...snapshotOf(current),
      tabs,
      lastActive,
    }
    set(next)
    persist(next)
    return candidate
  },
  rememberActivity: (dimension, pathname) => {
    const canonical = validActivityPath(pathname, dimension)
    if (!canonical) {
      console.error('activity path is invalid', dimension, pathname)
      return
    }
    const current = get()
    if (current.lastActivity === dimension && current.activityPaths[dimension] === canonical) return
    const next = {
      ...snapshotOf(current),
      lastActivity: dimension,
      activityPaths: { ...current.activityPaths, [dimension]: canonical },
    }
    set(next)
    persist(next)
  },
  showWorkbench: () => {
    const current = get()
    const next = { ...snapshotOf(current), lastActive: null }
    set({ lastActive: null })
    persist(next)
  },
  setActiveProject: activeProjectName => {
    const current = get()
    const next = {
      ...snapshotOf(current),
      activeProjectName,
      lastActivity: 'projects' as const,
      activityPaths: {
        ...current.activityPaths,
        projects: activityRootPath('projects', activeProjectName),
      },
    }
    set(next)
    persist(next)
  },
}))

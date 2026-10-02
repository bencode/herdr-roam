const session = {
  type: 'session',
  projectName: 'herdr-roam',
  provider: 'codex',
  sessionId: 'scan',
} as const
const otherProjectFile = {
  type: 'file',
  projectName: 'other-project',
  workspaceId: 'primary',
  path: 'README.md',
} as const
const userSkill = { type: 'skill', scope: 'user', skillId: 'frontend-design' } as const
const primaryFile = {
  type: 'file',
  projectName: 'herdr-roam',
  workspaceId: 'primary',
  path: 'README.md',
} as const
const linkedFile = { ...primaryFile, workspaceId: 'linked' } as const

describe('workbench store', () => {
  let storeModule: typeof import('./store')

  beforeEach(async () => {
    localStorage.clear()
    vi.resetModules()
    storeModule = await import('./store')
  })

  it('deduplicates resources while preserving cross-project tabs', () => {
    const { useWorkbenchStore } = storeModule
    useWorkbenchStore.getState().open(session)
    useWorkbenchStore.getState().open(otherProjectFile)
    useWorkbenchStore.getState().open(session)
    expect(useWorkbenchStore.getState().tabs).toEqual([session, otherProjectFile])
    expect(useWorkbenchStore.getState().lastActive).toEqual(session)
  })

  it('keeps the same path in different Workspaces as distinct tabs', () => {
    const { useWorkbenchStore } = storeModule
    useWorkbenchStore.getState().open(primaryFile)
    useWorkbenchStore.getState().open(linkedFile)
    useWorkbenchStore.getState().open(primaryFile)

    expect(useWorkbenchStore.getState().tabs).toEqual([primaryFile, linkedFile])
  })

  it('selects the right neighbor when closing the active tab', () => {
    const { useWorkbenchStore } = storeModule
    useWorkbenchStore.getState().open(session)
    useWorkbenchStore.getState().open(primaryFile)
    useWorkbenchStore.getState().open(session)
    expect(useWorkbenchStore.getState().closeMany([session])).toEqual(primaryFile)
    expect(useWorkbenchStore.getState().tabs).toEqual([primaryFile])
  })

  it('closes multiple tabs atomically and falls back to the nearest left neighbor', () => {
    const { useWorkbenchStore } = storeModule
    useWorkbenchStore.getState().open(session)
    useWorkbenchStore.getState().open(primaryFile)
    useWorkbenchStore.getState().open(userSkill)

    expect(useWorkbenchStore.getState().closeMany([primaryFile, userSkill])).toEqual(session)
    expect(useWorkbenchStore.getState().tabs).toEqual([session])
    expect(useWorkbenchStore.getState().lastActive).toEqual(session)
  })

  it('persists only the versioned workbench snapshot', () => {
    const { useWorkbenchStore } = storeModule
    useWorkbenchStore.getState().open(userSkill)
    expect(JSON.parse(localStorage.getItem('herdr-roam.workbench.v8') ?? '')).toEqual({
      version: 8,
      activeProjectName: 'herdr-roam',
      tabs: [userSkill],
      lastActive: userSkill,
      lastActivity: 'projects',
      activityPaths: {
        projects: '/projects/herdr-roam',
        agents: '/agents',
        skills: '/skills',
      },
    })
  })

  it('forgets Project-owned tabs without closing user Skills', () => {
    const { useWorkbenchStore } = storeModule
    useWorkbenchStore.getState().open(session)
    useWorkbenchStore.getState().open(otherProjectFile)
    useWorkbenchStore.getState().open(userSkill)

    useWorkbenchStore.getState().forgetProject('herdr-roam')

    expect(useWorkbenchStore.getState().tabs).toEqual([otherProjectFile, userSkill])
    expect(useWorkbenchStore.getState().lastActive).toEqual(userSkill)
  })

  it('remembers one canonical path per Activity', () => {
    const { useWorkbenchStore } = storeModule
    useWorkbenchStore
      .getState()
      .rememberActivity('projects', '/projects/herdr-roam/files/primary/docs/guide.md')
    useWorkbenchStore.getState().rememberActivity('agents', '/agents')

    expect(useWorkbenchStore.getState().lastActivity).toBe('agents')
    expect(useWorkbenchStore.getState().activityPaths).toEqual({
      projects: '/projects/herdr-roam/files/primary/docs/guide.md',
      agents: '/agents',
      skills: '/skills',
    })
  })

  it('changes the browsing Project without changing the active Activity', () => {
    const { useWorkbenchStore } = storeModule
    useWorkbenchStore.getState().rememberActivity('skills', '/skills/agents%3Afrontend-design')

    useWorkbenchStore.getState().setActiveProject('other-project')

    expect(useWorkbenchStore.getState()).toMatchObject({
      activeProjectName: 'other-project',
      lastActivity: 'skills',
      activityPaths: {
        projects: '/projects/other-project',
        skills: '/skills/agents%3Afrontend-design',
      },
    })
  })

  it('discards v7 workbench state after moving Agents to the Assistant panel', async () => {
    const agent = { type: 'agent', agentId: 'terminal-codex' }
    localStorage.setItem(
      'herdr-roam.workbench.v7',
      JSON.stringify({
        version: 7,
        activeProjectName: 'herdr-roam',
        tabs: [agent],
        lastActive: agent,
      }),
    )
    vi.resetModules()
    const { useWorkbenchStore } = await import('./store')

    expect(useWorkbenchStore.getState()).toMatchObject({ version: 8, tabs: [], lastActive: null })
    expect(localStorage.getItem('herdr-roam.workbench.v8')).toBeNull()
  })
})

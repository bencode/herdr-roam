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
const agent = { type: 'agent', agentId: 'terminal-codex' } as const
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
    useWorkbenchStore.getState().open(agent)

    expect(useWorkbenchStore.getState().closeMany([primaryFile, agent])).toEqual(session)
    expect(useWorkbenchStore.getState().tabs).toEqual([session])
    expect(useWorkbenchStore.getState().lastActive).toEqual(session)
  })

  it('persists only the versioned workbench snapshot', () => {
    const { useWorkbenchStore } = storeModule
    useWorkbenchStore.getState().open(agent)
    expect(JSON.parse(localStorage.getItem('herdr-roam.workbench.v7') ?? '')).toEqual({
      version: 7,
      activeProjectName: 'herdr-roam',
      tabs: [agent],
      lastActive: agent,
      lastActivity: 'projects',
      activityPaths: {
        projects: '/projects/herdr-roam',
        agents: '/agents',
        skills: '/skills',
      },
    })
  })

  it('forgets Project-owned tabs without closing global Agents', () => {
    const { useWorkbenchStore } = storeModule
    useWorkbenchStore.getState().open(session)
    useWorkbenchStore.getState().open(otherProjectFile)
    useWorkbenchStore.getState().open(agent)

    useWorkbenchStore.getState().forgetProject('herdr-roam')

    expect(useWorkbenchStore.getState().tabs).toEqual([otherProjectFile, agent])
    expect(useWorkbenchStore.getState().lastActive).toEqual(agent)
  })

  it('remembers one canonical path per Activity', () => {
    const { useWorkbenchStore } = storeModule
    useWorkbenchStore
      .getState()
      .rememberActivity(
        'projects',
        '/projects/herdr-roam/files/primary/docs/guide.md',
      )
    useWorkbenchStore.getState().rememberActivity('agents', '/agents/terminal-codex')

    expect(useWorkbenchStore.getState().lastActivity).toBe('agents')
    expect(useWorkbenchStore.getState().activityPaths).toEqual({
      projects: '/projects/herdr-roam/files/primary/docs/guide.md',
      agents: '/agents/terminal-codex',
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

  it('discards v6 workbench state after removing local Issue resources', async () => {
    localStorage.setItem(
      'herdr-roam.workbench.v6',
      JSON.stringify({
        version: 6,
        activeProjectName: 'herdr-roam',
        tabs: [agent],
        lastActive: agent,
      }),
    )
    vi.resetModules()
    const { useWorkbenchStore } = await import('./store')

    expect(useWorkbenchStore.getState()).toMatchObject({ version: 7, tabs: [], lastActive: null })
    expect(localStorage.getItem('herdr-roam.workbench.v7')).toBeNull()
  })
})

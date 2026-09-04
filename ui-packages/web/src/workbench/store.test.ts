const session = {
  type: 'session',
  projectName: 'herdr-roam',
  provider: 'codex',
  sessionId: 'scan',
} as const
const issue = { type: 'issue', projectName: 'other-project', issueId: 'hr-018' } as const
const agent = { type: 'agent', agentId: 'terminal-codex' } as const

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
    useWorkbenchStore.getState().open(issue)
    useWorkbenchStore.getState().open(session)
    expect(useWorkbenchStore.getState().tabs).toEqual([session, issue])
    expect(useWorkbenchStore.getState().lastActive).toEqual(session)
  })

  it('selects the right neighbor when closing the active tab', () => {
    const { useWorkbenchStore } = storeModule
    useWorkbenchStore.getState().open(session)
    useWorkbenchStore.getState().open(issue)
    useWorkbenchStore.getState().open(session)
    expect(useWorkbenchStore.getState().closeMany([session])).toEqual(issue)
    expect(useWorkbenchStore.getState().tabs).toEqual([issue])
  })

  it('closes multiple tabs atomically and falls back to the nearest left neighbor', () => {
    const { useWorkbenchStore } = storeModule
    useWorkbenchStore.getState().open(session)
    useWorkbenchStore.getState().open(issue)
    useWorkbenchStore.getState().open(agent)

    expect(useWorkbenchStore.getState().closeMany([issue, agent])).toEqual(session)
    expect(useWorkbenchStore.getState().tabs).toEqual([session])
    expect(useWorkbenchStore.getState().lastActive).toEqual(session)
  })

  it('persists only the versioned workbench snapshot', () => {
    const { useWorkbenchStore } = storeModule
    useWorkbenchStore.getState().open(agent)
    expect(JSON.parse(localStorage.getItem('herdr-roam.workbench.v4') ?? '')).toEqual({
      version: 4,
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
    useWorkbenchStore.getState().open(issue)
    useWorkbenchStore.getState().open(agent)

    useWorkbenchStore.getState().forgetProject('herdr-roam')

    expect(useWorkbenchStore.getState().tabs).toEqual([issue, agent])
    expect(useWorkbenchStore.getState().lastActive).toEqual(agent)
  })

  it('remembers one canonical path per Activity', () => {
    const { useWorkbenchStore } = storeModule
    useWorkbenchStore.getState().rememberActivity('projects', '/projects/herdr-roam/issues/hr-018')
    useWorkbenchStore.getState().rememberActivity('agents', '/agents/terminal-codex')

    expect(useWorkbenchStore.getState().lastActivity).toBe('agents')
    expect(useWorkbenchStore.getState().activityPaths).toEqual({
      projects: '/projects/herdr-roam/issues/hr-018',
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

  it('migrates v2 tabs and the last active resource into v4 navigation memory', async () => {
    localStorage.setItem(
      'herdr-roam.workbench.v2',
      JSON.stringify({
        version: 2,
        activeProjectName: 'herdr-roam',
        tabs: [agent],
        lastActive: agent,
      }),
    )
    vi.resetModules()
    const { useWorkbenchStore } = await import('./store')

    expect(useWorkbenchStore.getState()).toMatchObject({
      version: 4,
      tabs: [agent],
      lastActive: agent,
      lastActivity: 'agents',
      activityPaths: {
        projects: '/projects/herdr-roam',
        agents: '/agents/terminal-codex',
        skills: '/skills',
      },
    })
    expect(localStorage.getItem('herdr-roam.workbench.v4')).not.toBeNull()
  })
})

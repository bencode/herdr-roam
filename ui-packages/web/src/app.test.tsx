import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'
import { vi } from 'vitest'
import { App } from './app'
import { defaultWorkbenchSnapshot, useWorkbenchStore } from './workbench/store'

const projectMocks = vi.hoisted(() => ({
  projects: [
    { name: 'herdr-roam', path: '/work/herdr-roam' },
    { name: 'cc-mission-control', path: '/work/cc-mission-control' },
    { name: 'archive-herdr-roam', path: '/archive/herdr-roam' },
  ],
}))

vi.mock('./features/project/use-project-registry', () => ({
  useProjectRegistry: () => ({
    status: 'ready' as const,
    snapshot: {
      configPath: '/tmp/herdr-roam/config.json',
      projects: projectMocks.projects,
    },
    error: null,
    addProject: vi.fn().mockResolvedValue({ name: 'new-project', path: '/work/new-project' }),
    removeProject: vi.fn().mockResolvedValue({ name: 'herdr-roam', path: '/work/herdr-roam' }),
  }),
}))

vi.mock('./features/agent/client', () => ({
  fetchAgentSnapshot: vi.fn().mockResolvedValue({
    source: { state: 'connected', version: '0.8.2', protocol: 20 },
    stale: false,
    items: [
      {
        id: 'terminal-codex',
        name: 'codex-product',
        provider: 'codex',
        status: 'working',
        cwd: '/work/herdr-roam',
        attachTarget: 'w1:p1',
        session: null,
      },
    ],
  }),
  subscribeAgentSnapshots: vi.fn(() => () => undefined),
  fetchAgentOutput: vi
    .fn()
    .mockResolvedValue({ agentId: 'terminal-codex', text: 'Recent output', truncated: false }),
}))

vi.mock('./features/agent/runtime-provider', () => {
  const snapshot = {
    source: { state: 'connected' as const, version: '0.8.2', protocol: 20 },
    stale: false,
    items: [
      {
        id: 'terminal-codex',
        name: 'codex-product',
        provider: 'codex',
        status: 'working' as const,
        cwd: '/work/herdr-roam',
        attachTarget: 'w1:p1',
        session: null,
      },
    ],
  }
  return {
    AgentRuntimeProvider: ({ children }: { readonly children: ReactNode }) => children,
    useAgentRuntime: () => ({
      snapshot,
      transportError: null,
      agentById: (agentId: string) => snapshot.items.find(agent => agent.id === agentId),
    }),
  }
})

const sessionMocks = vi.hoisted(() => ({
  items: [
    {
      id: 'product-scan',
      provider: 'codex' as const,
      title: 'Product scan',
      cwd: '/work/herdr-roam',
      createdAt: '2026-08-31T10:00:00.000Z',
      updatedAt: '2026-09-01T10:00:00.000Z',
    },
    {
      id: 'mission-review',
      provider: 'claude' as const,
      title: 'Mission board review',
      cwd: '/work/cc-mission-control',
      createdAt: '2026-08-31T09:00:00.000Z',
      updatedAt: '2026-09-01T09:00:00.000Z',
    },
  ],
}))

vi.mock('./features/session/client', () => ({
  resumeSession: vi.fn(),
  SessionClientError: class SessionClientError extends Error {},
}))

vi.mock('./features/session/use-session-data', () => ({
  useProjectSessions: (projectName: string) => ({
    value: {
      items: sessionMocks.items.filter(session => session.cwd.endsWith(projectName)),
      total: sessionMocks.items.filter(session => session.cwd.endsWith(projectName)).length,
      nextCursor: null,
    },
    loading: false,
    error: null,
    page: 1,
    hasNewer: false,
    older: vi.fn(),
    newer: vi.fn(),
  }),
  useSessionData: (projectName: string, provider: 'codex' | 'claude', sessionId: string) => {
    const summary = sessionMocks.items.find(
      session =>
        session.cwd.endsWith(projectName) &&
        session.provider === provider &&
        session.id === sessionId,
    )
    return {
      value: summary
        ? {
            ...summary,
            mode: 'page' as const,
            entries: [
              {
                kind: 'message' as const,
                id: `${sessionId}-message`,
                role: 'assistant' as const,
                text: 'Session history',
                createdAt: summary.updatedAt,
                attachments: [],
              },
            ],
            olderCursor: null,
            tailCursor: 'tail-1',
            atLatest: true,
          }
        : null,
      loading: false,
      error: null,
      navigation: 'initial' as const,
      hasNewer: false,
      loadOlder: vi.fn(),
      loadNewer: vi.fn(),
      loadLatest: vi.fn(),
      reload: vi.fn(),
    }
  },
}))

const projectFileItems = vi.hoisted(
  (): Readonly<
    Record<
      string,
      readonly {
        readonly kind: 'directory' | 'file'
        readonly name: string
        readonly path: string
      }[]
    >
  > => ({
    '': [{ kind: 'directory', name: 'docs', path: 'docs' }],
    docs: [{ kind: 'directory', name: 'product', path: 'docs/product' }],
    'docs/product': [
      { kind: 'file', name: 'vision-and-scope.md', path: 'docs/product/vision-and-scope.md' },
    ],
  }),
)

vi.mock('./features/file/client', () => ({
  fetchProjectFiles: vi.fn((_projectName: string, options?: { readonly directory?: string }) => {
    const items = projectFileItems[options?.directory ?? ''] ?? []
    return Promise.resolve({ items, total: items.length, nextCursor: null })
  }),
  searchProjectFiles: vi.fn(() =>
    Promise.resolve({ items: projectFileItems['docs/product'], total: 1, nextCursor: null }),
  ),
  fetchProjectFile: vi.fn((_projectName: string, path: string) =>
    Promise.resolve({
      kind: 'markdown',
      path,
      name: path.split('/').at(-1) ?? path,
      size: 24,
      modifiedAt: '2026-09-01T00:00:00.000Z',
      mediaType: 'text/markdown',
      language: 'markdown',
      content: '# Vision and Scope\n',
    }),
  ),
  projectFileRawUrl: vi.fn((_projectName: string, path: string) => `/raw/${path}`),
  FileClientError: class FileClientError extends Error {},
}))

vi.mock('./features/skill/client', () => ({
  fetchSkillCatalog: vi.fn((projectName: string) =>
    Promise.resolve({
      items: [
        {
          id: 'codex:frontend-design',
          name: 'frontend-design',
          description: 'Design intentional interfaces.',
          source: 'codex' as const,
          scope: 'project' as const,
          projectName,
          location: '.codex/skills/frontend-design',
        },
        {
          id: 'agents:herdr-roam-issues',
          name: 'herdr-roam-issues',
          description: 'Work with local Issues.',
          source: 'agents' as const,
          scope: 'user' as const,
          location: '~/.agents/skills/herdr-roam-issues',
        },
      ],
      warnings: [],
    }),
  ),
  fetchSkillDetail: vi.fn((resource: { readonly skillId: string }) =>
    Promise.resolve({
      id: resource.skillId,
      name: resource.skillId.split(':').at(-1) ?? resource.skillId,
      description: 'Fixture Skill.',
      source: resource.skillId.startsWith('agents:') ? ('agents' as const) : ('codex' as const),
      scope: resource.skillId.startsWith('agents:') ? ('user' as const) : ('project' as const),
      location: '.skills/fixture',
      document: {
        kind: 'markdown' as const,
        path: 'SKILL.md',
        name: 'SKILL.md',
        size: 24,
        modifiedAt: '2026-09-01T00:00:00.000Z',
        mediaType: 'text/markdown',
        language: 'markdown',
        content: '# Fixture Skill\n',
      },
    }),
  ),
  fetchSkillFiles: vi.fn(() => Promise.resolve({ items: [], total: 0, nextCursor: null })),
  fetchSkillFile: vi.fn(),
  skillFileRawUrl: vi.fn((_resource: unknown, path: string) => `/skill-raw/${path}`),
  skillSourceLabel: (source: string) =>
    ({ agents: 'Agents', codex: 'Codex', claude: 'Claude' })[source],
  SkillClientError: class SkillClientError extends Error {},
}))

const selectProjectResource = (sidebar: ReturnType<typeof within>, resource: string) =>
  fireEvent.click(sidebar.getByRole('button', { name: resource }))

const openVisionFile = async (sidebar: ReturnType<typeof within>) => {
  fireEvent.click(await sidebar.findByRole('button', { name: 'docs' }))
  fireEvent.click(await sidebar.findByRole('button', { name: 'product' }))
  fireEvent.click(await sidebar.findByRole('button', { name: 'vision-and-scope.md' }))
  await screen.findByRole('heading', { name: 'Vision and Scope' })
}

const CurrentPath = () => <output data-testid="current-path">{useLocation().pathname}</output>

const HistoryBack = () => {
  const navigate = useNavigate()
  return (
    <button type="button" onClick={() => navigate(-1)}>
      History back
    </button>
  )
}

describe('workbench application', () => {
  beforeEach(() => {
    projectMocks.projects = [
      { name: 'herdr-roam', path: '/work/herdr-roam' },
      { name: 'cc-mission-control', path: '/work/cc-mission-control' },
      { name: 'archive-herdr-roam', path: '/archive/herdr-roam' },
    ]
    localStorage.clear()
    useWorkbenchStore.setState(defaultWorkbenchSnapshot)
  })

  it('keeps an empty registry in Projects', async () => {
    projectMocks.projects = []
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
        <CurrentPath />
      </MemoryRouter>,
    )

    await waitFor(() => expect(screen.getByTestId('current-path')).toHaveTextContent('/projects'))
    expect(screen.getByRole('heading', { name: 'Add a project to start' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Active project' })).toHaveTextContent('Add project')
  })

  it('opens and deduplicates Session tabs from the project sidebar', async () => {
    render(
      <MemoryRouter initialEntries={['/projects/herdr-roam']}>
        <App />
      </MemoryRouter>,
    )
    const sidebar = within(screen.getByTestId('context-sidebar'))
    fireEvent.click(await sidebar.findByRole('button', { name: /Product scan/ }))
    await waitFor(() => expect(screen.getByRole('tab', { name: /Product scan/ })).toBeVisible())
    fireEvent.click(sidebar.getByRole('button', { name: /Product scan/ }))
    expect(screen.getAllByRole('tab', { name: /Product scan/ })).toHaveLength(1)
    fireEvent.keyDown(screen.getByRole('tab', { name: /Product scan/ }), { key: 'ArrowLeft' })
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: 'Workbench' })).toHaveAttribute(
        'aria-selected',
        'true',
      ),
    )
  })

  it('preserves a File tab mode while switching resources', async () => {
    render(
      <MemoryRouter
        initialEntries={['/projects/herdr-roam/files/docs/product/vision-and-scope.md']}
      >
        <App />
        <CurrentPath />
      </MemoryRouter>,
    )
    const source = await screen.findByRole('button', { name: 'source' })
    await within(screen.getByTestId('context-sidebar')).findByRole('button', {
      name: 'vision-and-scope.md',
    })
    fireEvent.click(source)
    await screen.findByRole('region', { name: 'markdown source' })
    const sidebar = within(screen.getByTestId('context-sidebar'))
    selectProjectResource(sidebar, 'Sessions')
    expect(screen.getByTestId('current-path')).toHaveTextContent(
      '/projects/herdr-roam/files/docs/product/vision-and-scope.md',
    )
    expect(screen.getByRole('tab', { name: /vision-and-scope.md/ })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByRole('button', { name: 'source' })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(await sidebar.findByRole('button', { name: /Product scan/ }))
    await waitFor(() =>
      expect(screen.getByTestId('current-path')).toHaveTextContent(
        '/projects/herdr-roam/sessions/codex/product-scan',
      ),
    )
    fireEvent.click(screen.getByRole('tab', { name: /vision-and-scope.md/ }))
    expect(screen.getByRole('button', { name: 'source' })).toHaveAttribute('aria-pressed', 'true')
    await sidebar.findByRole('button', { name: 'vision-and-scope.md' })
  })

  it('preserves a Session tab across Activities and omits unavailable actions', async () => {
    render(
      <MemoryRouter initialEntries={['/projects/herdr-roam/sessions/codex/product-scan']}>
        <App />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Session history')).toBeVisible()
    const sidebar = within(screen.getByTestId('context-sidebar'))
    selectProjectResource(sidebar, 'Files')
    await openVisionFile(sidebar)
    fireEvent.click(screen.getByRole('tab', { name: /Product scan/ }))

    expect(screen.getByRole('button', { name: 'Resume Session' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Search' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tab actions' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Inspector' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Attach/ })).not.toBeInTheDocument()
  })

  it('focuses a Session workbench and exits with Escape', async () => {
    render(
      <MemoryRouter initialEntries={['/projects/herdr-roam/sessions/codex/product-scan']}>
        <App />
      </MemoryRouter>,
    )

    await screen.findByText('Session history')
    fireEvent.click(screen.getByRole('button', { name: 'Enter focus mode' }))
    expect(screen.getByRole('button', { name: 'Exit focus mode' }).closest('.fixed')).not.toBeNull()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.getByRole('button', { name: 'Enter focus mode' }).closest('.fixed')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Enter focus mode' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Workbench' }))
    expect(screen.queryByRole('button', { name: 'Exit focus mode' })).not.toBeInTheDocument()
  })

  it('opens Issue, File, and Skill resources in the same tablist', async () => {
    render(
      <MemoryRouter initialEntries={['/projects/herdr-roam']}>
        <App />
      </MemoryRouter>,
    )
    const sidebar = within(screen.getByTestId('context-sidebar'))
    selectProjectResource(sidebar, 'Issues')
    fireEvent.click(sidebar.getByRole('button', { name: /Clarify runtime ownership/ }))
    selectProjectResource(sidebar, 'Files')
    await openVisionFile(sidebar)
    fireEvent.click(screen.getByRole('link', { name: 'Skills' }))
    fireEvent.click(await sidebar.findByRole('button', { name: /herdr-roam-issues/ }))
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'HR-018' })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /vision-and-scope.md/ })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /herdr-roam-issues/ })).toBeInTheDocument()
    })
  })

  it('keeps the context target active when closing its other tabs', async () => {
    render(
      <MemoryRouter
        initialEntries={['/projects/herdr-roam/files/docs/product/vision-and-scope.md']}
      >
        <App />
        <CurrentPath />
      </MemoryRouter>,
    )
    const sidebar = within(screen.getByTestId('context-sidebar'))
    selectProjectResource(sidebar, 'Sessions')
    fireEvent.click(await sidebar.findByRole('button', { name: /Product scan/ }))
    selectProjectResource(sidebar, 'Issues')
    fireEvent.click(sidebar.getByRole('button', { name: /Clarify runtime ownership/ }))

    fireEvent.contextMenu(screen.getByRole('tab', { name: /vision-and-scope.md/ }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Close Other Tabs' }))

    await waitFor(() =>
      expect(screen.getByTestId('current-path')).toHaveTextContent(
        '/projects/herdr-roam/files/docs/product/vision-and-scope.md',
      ),
    )
    expect(useWorkbenchStore.getState().tabs).toEqual([
      {
        type: 'file',
        projectName: 'herdr-roam',
        path: 'docs/product/vision-and-scope.md',
      },
    ])
  })

  it('preserves project browser state while switching global activities', () => {
    render(
      <MemoryRouter initialEntries={['/projects/herdr-roam']}>
        <App />
      </MemoryRouter>,
    )
    const sidebar = within(screen.getByTestId('context-sidebar'))
    selectProjectResource(sidebar, 'Issues')
    fireEvent.change(sidebar.getByRole('textbox', { name: 'Search issues' }), {
      target: { value: 'runtime' },
    })

    fireEvent.click(screen.getByRole('link', { name: 'Agents' }))
    expect(sidebar.getByRole('textbox', { name: 'Search agents' })).toBeVisible()
    fireEvent.click(screen.getByRole('link', { name: 'Projects' }))

    expect(sidebar.getByRole('button', { name: 'Issues' })).toHaveAttribute('aria-pressed', 'true')
    expect(sidebar.getByRole('textbox', { name: 'Search issues' })).toHaveValue('runtime')
  })

  it('restores the exact Project route after visiting another Activity', async () => {
    render(
      <MemoryRouter initialEntries={['/projects/herdr-roam/issues/hr-018']}>
        <App />
        <CurrentPath />
      </MemoryRouter>,
    )

    await screen.findByRole('tab', { name: 'HR-018' })
    expect(screen.getByRole('link', { name: 'Projects' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Issues' })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('link', { name: 'Agents' }))
    await waitFor(() => expect(screen.getByTestId('current-path')).toHaveTextContent('/agents'))
    expect(screen.getByRole('link', { name: 'Agents' })).toHaveAttribute('aria-current', 'page')

    fireEvent.click(screen.getByRole('link', { name: 'Projects' }))
    await waitFor(() =>
      expect(screen.getByTestId('current-path')).toHaveTextContent(
        '/projects/herdr-roam/issues/hr-018',
      ),
    )
    expect(screen.getByRole('button', { name: 'Issues' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('derives Skills selection from a project Skill route', async () => {
    render(
      <MemoryRouter initialEntries={['/projects/herdr-roam/skills/codex%3Afrontend-design']}>
        <App />
      </MemoryRouter>,
    )

    await screen.findByRole('tab', { name: /frontend-design/ })
    expect(screen.getByRole('link', { name: 'Skills' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('textbox', { name: 'Search skills' })).toBeVisible()
  })

  it('changes the Project group without leaving Skills', async () => {
    render(
      <MemoryRouter initialEntries={['/skills']}>
        <App />
        <CurrentPath />
      </MemoryRouter>,
    )

    await screen.findByRole('heading', { name: /Project · herdr-roam/i })
    fireEvent.click(screen.getByRole('button', { name: 'Active project' }))
    fireEvent.click(await screen.findByRole('button', { name: 'cc-mission-control' }))

    await screen.findByRole('heading', { name: /Project · cc-mission-control/i })
    expect(screen.getByTestId('current-path')).toHaveTextContent('/skills')
    expect(screen.getByRole('link', { name: 'Skills' })).toHaveAttribute('aria-current', 'page')
  })

  it('updates Activity and Project section state through browser history', async () => {
    render(
      <MemoryRouter initialEntries={['/projects/herdr-roam/files']}>
        <App />
        <CurrentPath />
        <HistoryBack />
      </MemoryRouter>,
    )

    expect(screen.getByRole('button', { name: 'Files' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('link', { name: 'Agents' }))
    await waitFor(() => expect(screen.getByTestId('current-path')).toHaveTextContent('/agents'))
    fireEvent.click(screen.getByRole('button', { name: 'History back' }))

    await waitFor(() =>
      expect(screen.getByTestId('current-path')).toHaveTextContent('/projects/herdr-roam/files'),
    )
    expect(screen.getByRole('link', { name: 'Projects' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Files' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('collapses to the Activity rail and expands from a global activity without losing state', () => {
    render(
      <MemoryRouter initialEntries={['/projects/herdr-roam']}>
        <App />
      </MemoryRouter>,
    )
    const sidebar = within(screen.getByTestId('context-sidebar'))
    expect(sidebar.getByRole('img', { name: 'Roam' })).toBeVisible()
    expect(sidebar.getByRole('button', { name: 'Active project' })).toBeVisible()

    selectProjectResource(sidebar, 'Issues')
    fireEvent.change(sidebar.getByRole('textbox', { name: 'Search issues' }), {
      target: { value: 'runtime' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }))

    expect(sidebar.getByTestId('sidebar-context')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.queryByRole('button', { name: 'Collapse sidebar' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeVisible()

    fireEvent.click(sidebar.getByRole('link', { name: 'Agents' }))
    expect(sidebar.getByRole('textbox', { name: 'Search agents' })).toBeVisible()
    fireEvent.click(sidebar.getByRole('link', { name: 'Projects' }))
    expect(sidebar.getByRole('button', { name: 'Issues' })).toHaveAttribute('aria-pressed', 'true')
    expect(sidebar.getByRole('textbox', { name: 'Search issues' })).toHaveValue('runtime')
  })

  it('keeps the Active Project while opening a resource owned by another project', async () => {
    render(
      <MemoryRouter
        initialEntries={['/projects/cc-mission-control/sessions/claude/mission-review']}
      >
        <App />
      </MemoryRouter>,
    )

    await waitFor(() =>
      expect(screen.getByRole('tab', { name: /Mission board review/ })).toHaveAttribute(
        'aria-selected',
        'true',
      ),
    )
    expect(screen.getByRole('button', { name: 'Active project' })).toHaveTextContent('herdr-roam')
  })

  it('changes Theme without changing the active resource route', async () => {
    render(
      <MemoryRouter initialEntries={['/projects/herdr-roam/sessions/codex/product-scan']}>
        <App />
        <CurrentPath />
      </MemoryRouter>,
    )

    await waitFor(() =>
      expect(screen.getByRole('tab', { name: /Product scan/ })).toHaveAttribute(
        'aria-selected',
        'true',
      ),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Theme: System' }))
    expect(screen.getByRole('radiogroup', { name: 'Theme' })).toBeVisible()
    fireEvent.click(screen.getByRole('radio', { name: 'Dark' }))

    expect(screen.getByTestId('current-path')).toHaveTextContent(
      '/projects/herdr-roam/sessions/codex/product-scan',
    )
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(screen.getByRole('button', { name: 'Theme: Dark' })).toBeVisible()
    expect(useWorkbenchStore.getState().tabs).toHaveLength(1)
    expect(screen.getByRole('tab', { name: /Product scan/ })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.queryByRole('tab', { name: 'Runtime' })).not.toBeInTheDocument()
  })

  it('opens a real Agent as an independent route-backed tab', async () => {
    render(
      <MemoryRouter initialEntries={['/projects/herdr-roam']}>
        <App />
        <CurrentPath />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('link', { name: 'Agents' }))
    fireEvent.click(await screen.findByRole('button', { name: /codex-product/ }))

    expect(screen.getByTestId('current-path')).toHaveTextContent('/agents/terminal-codex')
    expect(screen.getByRole('button', { name: /codex-product/, current: 'page' })).toBeVisible()
    expect(screen.getByRole('tab', { name: /codex-product/ })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Copy attach command' })).toBeVisible()
    expect(await screen.findByText('Recent output')).toBeVisible()
    expect(useWorkbenchStore.getState().tabs).toEqual([
      { type: 'agent', agentId: 'terminal-codex' },
    ])
  })
})

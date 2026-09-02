import type {
  AgentRuntimeSnapshot,
  Project,
  SessionHistoryPage,
  SessionSummary,
} from '@herdr-roam/shared'
import { describe, expect, it, vi } from 'vitest'
import type { AgentServiceApi } from '../agents/service.js'
import type { ProjectRegistryApi } from '../projects/registry.js'
import { createSessionRoutes } from './routes.js'
import type { SessionServiceApi } from './service.js'

const project: Project = { name: 'herdr-roam', path: '/work/herdr-roam' }
const session: SessionSummary = {
  id: 'session-1',
  provider: 'codex',
  title: 'Review release',
  cwd: project.path,
  createdAt: '2026-09-01T08:00:00.000Z',
  updatedAt: '2026-09-01T09:00:00.000Z',
}
const page: SessionHistoryPage = {
  ...session,
  mode: 'page',
  entries: [],
  olderCursor: null,
  tailCursor: 'tail-1',
  atLatest: true,
}
const snapshot: AgentRuntimeSnapshot = {
  source: { state: 'connected', version: '0.8.2', protocol: 20 },
  stale: false,
  items: [],
}

const sessions = (values: Partial<SessionServiceApi> = {}): SessionServiceApi => ({
  list: vi.fn().mockResolvedValue({ items: [session], total: 1, nextCursor: null }),
  resumeTarget: vi.fn().mockResolvedValue({ session, latestCwd: '/work/herdr-roam-worktree' }),
  page: vi.fn().mockResolvedValue(page),
  delta: vi.fn().mockResolvedValue({
    mode: 'delta',
    entries: [],
    activityUpdates: [],
    tailCursor: 'tail-2',
    caughtUp: true,
  }),
  ...values,
})

const agents = (values: Partial<AgentServiceApi> = {}): AgentServiceApi => ({
  snapshot: () => snapshot,
  subscribe: () => () => undefined,
  output: vi.fn(),
  prompt: vi.fn(),
  input: vi.fn(),
  focus: vi.fn(),
  launch: vi.fn(),
  resume: vi.fn().mockResolvedValue({
    reused: false,
    agent: {
      id: 'terminal-1',
      name: 'codex-herdr-roam',
      provider: 'codex',
      status: 'idle',
      cwd: project.path,
      attachTarget: 'w1:p1',
      session: { source: 'process', agent: 'codex', kind: 'id', value: session.id },
    },
  }),
  ...values,
})

const projects: ProjectRegistryApi = {
  snapshot: vi.fn(),
  get: vi.fn().mockResolvedValue(project),
  add: vi.fn(),
  discover: vi.fn(),
  remove: vi.fn(),
  subscribe: vi.fn(),
}

describe('Session routes', () => {
  it('lists, reads, and resumes native Sessions through explicit provider routes', async () => {
    const sessionService = sessions()
    const agentService = agents()
    const routes = createSessionRoutes(sessionService, agentService, projects)

    const list = await routes.request('/herdr-roam/sessions')
    const detail = await routes.request('/herdr-roam/sessions/codex/session-1')
    const delta = await routes.request('/herdr-roam/sessions/codex/session-1?after=tail-1')
    const resumed = await routes.request('/herdr-roam/sessions/codex/session-1/resume', {
      method: 'POST',
    })

    expect(list.status).toBe(200)
    await expect(list.json()).resolves.toEqual({ items: [session], total: 1, nextCursor: null })
    expect(detail.status).toBe(200)
    await expect(detail.json()).resolves.toEqual(page)
    expect(delta.status).toBe(200)
    await expect(delta.json()).resolves.toMatchObject({ mode: 'delta', tailCursor: 'tail-2' })
    expect(resumed.status).toBe(201)
    expect(agentService.resume).toHaveBeenCalledWith(project, session, '/work/herdr-roam-worktree')
  })

  it('rejects unsupported providers and missing Sessions', async () => {
    const routes = createSessionRoutes(
      sessions({ page: vi.fn().mockResolvedValue(null) }),
      agents(),
      projects,
    )

    expect((await routes.request('/herdr-roam/sessions/other/session-1')).status).toBe(400)
    expect((await routes.request('/herdr-roam/sessions/codex/missing')).status).toBe(404)
  })
})

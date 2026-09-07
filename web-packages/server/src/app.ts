import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { createAgentRoutes } from './agents/routes.js'
import type { AgentServiceApi } from './agents/service.js'
import { createFileRoutes } from './files/routes.js'
import type { ProjectRegistryApi } from './projects/registry.js'
import { createProjectRoutes } from './projects/routes.js'
import { createSessionRoutes } from './sessions/routes.js'
import type { SessionServiceApi } from './sessions/service.js'
import { createSkillRoutes } from './skills/routes.js'

export const createApp = (
  service: AgentServiceApi,
  projects: ProjectRegistryApi,
  sessions: SessionServiceApi,
  webRoot?: string,
): Hono => {
  const app = new Hono()

  app.get('/healthz', context => context.json({ status: 'ok' as const }))
  app.route('/api/agents', createAgentRoutes(service, projects))
  app.route('/api/projects', createProjectRoutes(projects))
  app.route('/api/projects', createFileRoutes(projects))
  app.route('/api/projects', createSessionRoutes(sessions, service, projects))
  app.route('/api/skills', createSkillRoutes(projects))

  if (webRoot) {
    app.use('*', serveStatic({ root: webRoot }))
    app.get('*', async context => context.html(await readFile(join(webRoot, 'index.html'), 'utf8')))
  }

  return app
}

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { createAgentRoutes } from './agents/routes.js'
import type { AgentServiceApi } from './agents/service.js'
import { createProjectRoutes } from './projects/routes.js'
import type { ProjectRegistryApi } from './projects/registry.js'

export const createApp = (
  service: AgentServiceApi,
  projects: ProjectRegistryApi,
  webRoot?: string,
): Hono => {
  const app = new Hono()

  app.get('/healthz', context => context.json({ status: 'ok' as const }))
  app.route('/api/agents', createAgentRoutes(service))
  app.route('/api/projects', createProjectRoutes(projects))

  if (webRoot) {
    app.use('*', serveStatic({ root: webRoot }))
    app.get('*', async context => context.html(await readFile(join(webRoot, 'index.html'), 'utf8')))
  }

  return app
}

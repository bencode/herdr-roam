import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { createAgentRoutes } from './agents/routes.js'
import type { AgentServiceApi } from './agents/service.js'

export const createApp = (service: AgentServiceApi, webRoot?: string): Hono => {
  const app = new Hono()

  app.get('/healthz', context => context.json({ status: 'ok' as const }))
  app.route('/api/agents', createAgentRoutes(service))

  if (webRoot) {
    app.use('*', serveStatic({ root: webRoot }))
    app.get('*', async context => context.html(await readFile(join(webRoot, 'index.html'), 'utf8')))
  }

  return app
}

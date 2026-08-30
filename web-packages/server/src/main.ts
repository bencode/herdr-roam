import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { serve } from '@hono/node-server'
import { createAgentService } from './agents/service.js'
import { createApp } from './app.js'
import { projectConfigPath, serverConfig } from './config.js'
import { createProjectRegistry } from './projects/registry.js'

const moduleDirectory = dirname(fileURLToPath(import.meta.url))
const webRoot = resolve(moduleDirectory, '../../../ui-packages/web/dist')
const agentService = createAgentService()
const projectRegistry = createProjectRegistry(projectConfigPath)
agentService.start()

const app = createApp(agentService, projectRegistry, existsSync(webRoot) ? webRoot : undefined)
const server = serve({
  fetch: app.fetch,
  hostname: serverConfig.host,
  port: serverConfig.port,
})

console.info(`Herdr Roam listening on http://${serverConfig.host}:${serverConfig.port}`)

const shutdown = (signal: NodeJS.Signals) => {
  console.info(`Received ${signal}; shutting down.`)
  agentService.stop()
  server.close(error => {
    if (error) {
      console.error('Server shutdown failed', error)
      process.exitCode = 1
    }
  })
}

process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)

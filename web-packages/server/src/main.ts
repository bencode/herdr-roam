import { existsSync } from 'node:fs'
import { Server } from 'node:http'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { serve } from '@hono/node-server'
import { createAgentService } from './agents/service.js'
import { registerAgentTerminals } from './agents/terminal.js'
import { createApp } from './app.js'
import { projectConfigPath, serverConfig, sessionRoots } from './config.js'
import { startProjectDiscovery } from './projects/discovery.js'
import { createProjectRegistry } from './projects/registry.js'
import { createSessionService } from './sessions/service.js'

const moduleDirectory = dirname(fileURLToPath(import.meta.url))
const webRoot = resolve(moduleDirectory, '../../../ui-packages/web/dist')
const agentService = createAgentService()
const projectRegistry = createProjectRegistry(projectConfigPath)
const sessionService = createSessionService(sessionRoots)
const stopProjectDiscovery = startProjectDiscovery(agentService, projectRegistry)
agentService.start()

const app = createApp(
  agentService,
  projectRegistry,
  sessionService,
  existsSync(webRoot) ? webRoot : undefined,
)
const server = serve({
  fetch: app.fetch,
  hostname: serverConfig.host,
  port: serverConfig.port,
})

console.info(`Herdr Roam listening on http://${serverConfig.host}:${serverConfig.port}`)
if (!(server instanceof Server)) throw new Error('Browser terminals require an HTTP/1 server.')
const stopTerminals = registerAgentTerminals(server, agentService)

const shutdown = (signal: NodeJS.Signals) => {
  console.info(`Received ${signal}; shutting down.`)
  stopProjectDiscovery()
  stopTerminals()
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

import type { ProjectRegistrySnapshot } from '@herdr-roam/shared'
import { describe, expect, it, vi } from 'vitest'
import { createProjectRoutes } from './routes.js'
import { ProjectRegistryError, type ProjectRegistryApi } from './registry.js'

const snapshot: ProjectRegistrySnapshot = {
  configPath: '/tmp/herdr-roam/config.json',
  projects: [{ name: 'herdr-roam', path: '/work/herdr-roam' }],
}

const registry = (values: Partial<ProjectRegistryApi> = {}): ProjectRegistryApi => ({
  snapshot: vi.fn().mockResolvedValue(snapshot),
  get: vi.fn().mockResolvedValue(null),
  add: vi.fn().mockResolvedValue(snapshot.projects[0]),
  ...values,
})

describe('Project routes', () => {
  it('returns the registry and adds a validated Project', async () => {
    const service = registry()
    const routes = createProjectRoutes(service)
    await expect((await routes.request('/')).json()).resolves.toEqual(snapshot)

    const response = await routes.request('/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'herdr-roam', path: '/work/herdr-roam' }),
    })
    expect(response.status).toBe(201)
    expect(service.add).toHaveBeenCalledWith({
      name: 'herdr-roam',
      path: '/work/herdr-roam',
    })
  })

  it('maps registry failures without hiding the configuration path', async () => {
    const error = new ProjectRegistryError(
      'project_config_invalid',
      'invalid config',
      '/tmp/herdr-roam/config.json',
    )
    const response = await createProjectRoutes(
      registry({ snapshot: vi.fn().mockRejectedValue(error) }),
    ).request('/')

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'project_config_invalid',
        message: 'invalid config',
        configPath: '/tmp/herdr-roam/config.json',
      },
    })
  })
})

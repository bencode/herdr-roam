import { afterEach, describe, expect, it, vi } from 'vitest'
import { createProject, fetchProjects } from './client'

afterEach(() => vi.restoreAllMocks())

describe('Project API client', () => {
  it('loads the registry and submits a Project', async () => {
    const snapshot = {
      configPath: '/tmp/herdr-roam/config.json',
      projects: [{ name: 'herdr-roam', path: '/work/herdr-roam' }],
    }
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(snapshot), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ...snapshot, project: snapshot.projects[0] }), {
          status: 201,
        }),
      )

    await expect(fetchProjects()).resolves.toEqual(snapshot)
    await expect(
      createProject({ name: 'herdr-roam', path: '/work/herdr-roam' }),
    ).resolves.toMatchObject({ project: snapshot.projects[0] })
    expect(fetch).toHaveBeenLastCalledWith('/api/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'herdr-roam', path: '/work/herdr-roam' }),
    })
  })

  it('preserves typed Project API errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: 'project_config_invalid',
            message: 'invalid config',
            configPath: '/tmp/herdr-roam/config.json',
          },
        }),
        { status: 500 },
      ),
    )

    await expect(fetchProjects()).rejects.toMatchObject({
      code: 'project_config_invalid',
      configPath: '/tmp/herdr-roam/config.json',
    })
  })
})

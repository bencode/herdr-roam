import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchProjectWorkspaces } from './workspace-client'

afterEach(() => vi.unstubAllGlobals())

describe('Project Workspace client', () => {
  it('loads the encoded Project Workspace catalog', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            {
              id: 'primary',
              name: 'project',
              path: '/work/project',
              kind: 'worktree',
              branch: 'main',
              primary: true,
            },
          ],
        }),
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchProjectWorkspaces('my project')).resolves.toMatchObject({
      items: [expect.objectContaining({ id: 'primary', branch: 'main' })],
    })
    expect(fetchMock).toHaveBeenCalledWith('/api/projects/my%20project/workspaces', {
      signal: undefined,
    })
  })
})

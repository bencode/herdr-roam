import type { ProjectRegistrySnapshot } from '@herdr-roam/shared'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  fetchProjects: vi.fn(),
  createProject: vi.fn(),
  removeProject: vi.fn(),
  subscribe: vi.fn(),
  listener: null as ((snapshot: ProjectRegistrySnapshot) => void) | null,
}))

vi.mock('./client', async importOriginal => {
  const original = await importOriginal<typeof import('./client')>()
  return {
    ...original,
    fetchProjects: mocks.fetchProjects,
    createProject: mocks.createProject,
    removeProject: mocks.removeProject,
    subscribeProjectSnapshots: mocks.subscribe,
  }
})

import { useProjectRegistry } from './use-project-registry'

const initial: ProjectRegistrySnapshot = {
  configPath: '/tmp/herdr-roam/config.json',
  projects: [{ name: 'herdr-roam', path: '/work/herdr-roam' }],
}

describe('useProjectRegistry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.listener = null
    mocks.fetchProjects.mockResolvedValue(initial)
    mocks.subscribe.mockImplementation((listener: (snapshot: ProjectRegistrySnapshot) => void) => {
      mocks.listener = listener
      return () => {
        mocks.listener = null
      }
    })
  })

  it('loads Projects and replaces them from the live registry stream', async () => {
    const { result } = renderHook(() => useProjectRegistry())
    await waitFor(() => expect(result.current.status).toBe('ready'))
    const next = {
      ...initial,
      projects: [...initial.projects, { name: 'other', path: '/work/other' }],
    }

    act(() => mocks.listener?.(next))

    expect(result.current.snapshot).toEqual(next)
  })
})

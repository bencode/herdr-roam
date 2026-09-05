import type { ProjectWorkspaceCatalog } from '@herdr-roam/shared'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchProjectWorkspaces } from './client'
import { useProjectWorkspaces } from './use-project-workspaces'

vi.mock('./client', async importOriginal => ({
  ...(await importOriginal<typeof import('./client')>()),
  fetchProjectWorkspaces: vi.fn(),
}))

const catalog = (name: string): ProjectWorkspaceCatalog => ({
  items: [
    { id: 'primary', name, path: `/work/${name}`, kind: 'directory', branch: null, primary: true },
  ],
})

const fetchDirectories = vi.mocked(fetchProjectWorkspaces)

beforeEach(() => fetchDirectories.mockReset())

describe('Project directory requests', () => {
  it.each(['success', 'failure'] as const)(
    'ignores a previous project retry that finishes with %s',
    async completion => {
      const retry = Promise.withResolvers<ProjectWorkspaceCatalog>()
      fetchDirectories
        .mockRejectedValueOnce(new Error('temporary failure'))
        .mockReturnValueOnce(retry.promise)
        .mockResolvedValueOnce(catalog('beta'))
      const view = renderHook(({ name }) => useProjectWorkspaces(name), {
        initialProps: { name: 'alpha' },
      })
      await waitFor(() => expect(view.result.current.error).not.toBeNull())
      act(() => view.result.current.retry())
      view.rerender({ name: 'beta' })
      await waitFor(() => expect(view.result.current.items).toEqual(catalog('beta').items))
      await act(async () => {
        if (completion === 'success') retry.resolve(catalog('alpha'))
        else retry.reject(new Error('late failure'))
      })
      expect(view.result.current).toMatchObject({
        items: catalog('beta').items,
        loading: false,
        error: null,
      })
    },
  )

  it('preserves directories during retry and accepts only the newest retry', async () => {
    const earlier = Promise.withResolvers<ProjectWorkspaceCatalog>()
    const latest = Promise.withResolvers<ProjectWorkspaceCatalog>()
    fetchDirectories
      .mockResolvedValueOnce(catalog('alpha'))
      .mockReturnValueOnce(earlier.promise)
      .mockReturnValueOnce(latest.promise)
    const { result } = renderHook(() => useProjectWorkspaces('alpha'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.retry())
    expect(result.current).toMatchObject({
      items: catalog('alpha').items,
      loading: true,
      error: null,
    })
    act(() => result.current.retry())
    await act(async () => latest.resolve({ items: [] }))
    await act(async () => earlier.resolve(catalog('alpha')))
    expect(result.current).toMatchObject({ items: [], loading: false, error: null })
  })

  it('hides previous directories on the first render of another project', async () => {
    const pending = Promise.withResolvers<ProjectWorkspaceCatalog>()
    fetchDirectories.mockResolvedValueOnce(catalog('alpha')).mockReturnValueOnce(pending.promise)
    const observed: ReturnType<typeof useProjectWorkspaces>[] = []
    const view = renderHook(
      ({ name }) => {
        const state = useProjectWorkspaces(name)
        if (name === 'beta') observed.push(state)
        return state
      },
      { initialProps: { name: 'alpha' } },
    )
    await waitFor(() => expect(view.result.current.loading).toBe(false))
    view.rerender({ name: 'beta' })
    expect(observed[0]).toMatchObject({ items: [], loading: true, error: null })
    await act(async () => pending.resolve(catalog('beta')))
  })

  it('cancels a pending retry when unmounted', async () => {
    const pending = Promise.withResolvers<ProjectWorkspaceCatalog>()
    fetchDirectories.mockResolvedValueOnce(catalog('alpha')).mockReturnValueOnce(pending.promise)
    const view = renderHook(() => useProjectWorkspaces('alpha'))
    await waitFor(() => expect(view.result.current.loading).toBe(false))
    act(() => view.result.current.retry())
    const signal = fetchDirectories.mock.calls[1]?.[1]
    expect(signal?.aborted).toBe(false)
    view.unmount()
    expect(signal?.aborted).toBe(true)
    await act(async () => pending.reject(new Error('late failure')))
  })
})

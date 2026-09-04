import type { ProjectFileEntry } from '@herdr-roam/shared'
import { useCallback, useEffect, useState } from 'react'
import { FileClientError, fetchProjectFiles, searchProjectFiles } from './client'

type CatalogState = {
  readonly items: readonly ProjectFileEntry[]
  readonly total: number
  readonly nextCursor: string | null
  readonly loading: boolean
  readonly error: FileClientError | null
}

const emptyState: CatalogState = {
  items: [],
  total: 0,
  nextCursor: null,
  loading: true,
  error: null,
}

const asClientError = (error: unknown): FileClientError =>
  error instanceof FileClientError
    ? error
    : new FileClientError('network_error', 'Project files could not be loaded.', { cause: error })

export const useFileCatalog = ({
  projectName,
  workspaceId,
  directory = '',
  query = '',
}: {
  readonly projectName: string
  readonly workspaceId: string
  readonly directory?: string
  readonly query?: string
}) => {
  const [state, setState] = useState<CatalogState>(emptyState)
  const normalizedQuery = query.trim()

  const load = useCallback(
    async (cursor: string | undefined, signal?: AbortSignal) => {
      setState(current => ({ ...current, loading: true, error: null }))
      try {
        const page = normalizedQuery
          ? await searchProjectFiles(projectName, workspaceId, normalizedQuery, { cursor, signal })
          : await fetchProjectFiles(projectName, workspaceId, { directory, cursor, signal })
        if (signal?.aborted) return
        setState(current => ({
          items: cursor ? [...current.items, ...page.items] : page.items,
          total: page.total,
          nextCursor: page.nextCursor,
          loading: false,
          error: null,
        }))
      } catch (error) {
        if (signal?.aborted || (error instanceof DOMException && error.name === 'AbortError'))
          return
        setState(current => ({ ...current, loading: false, error: asClientError(error) }))
      }
    },
    [directory, normalizedQuery, projectName, workspaceId],
  )

  useEffect(() => {
    const controller = new AbortController()
    setState(emptyState)
    void load(undefined, controller.signal)
    return () => controller.abort()
  }, [load])

  return {
    ...state,
    loadMore: () => {
      if (!state.loading && state.nextCursor) void load(state.nextCursor)
    },
    retry: () => void load(undefined),
  }
}

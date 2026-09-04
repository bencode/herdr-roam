import type { ProjectWorkspace } from '@herdr-roam/shared'
import { useCallback, useEffect, useState } from 'react'
import { fetchProjectWorkspaces, FileClientError } from './client'

type State = {
  readonly items: readonly ProjectWorkspace[]
  readonly loading: boolean
  readonly error: FileClientError | null
}

const initialState: State = { items: [], loading: true, error: null }

const clientError = (error: unknown): FileClientError =>
  error instanceof FileClientError
    ? error
    : new FileClientError('network_error', 'Project Workspaces could not be loaded.', {
        cause: error,
      })

export const useProjectWorkspaces = (projectName: string) => {
  const [state, setState] = useState<State>(initialState)

  const load = useCallback(
    (signal?: AbortSignal) => {
      setState(current => ({ ...current, loading: true, error: null }))
      void fetchProjectWorkspaces(projectName, signal).then(
        value => {
          if (!signal?.aborted) setState({ items: value.items, loading: false, error: null })
        },
        error => {
          if (signal?.aborted || (error instanceof DOMException && error.name === 'AbortError'))
            return
          setState({ items: [], loading: false, error: clientError(error) })
        },
      )
    },
    [projectName],
  )

  useEffect(() => {
    const controller = new AbortController()
    setState(initialState)
    load(controller.signal)
    return () => controller.abort()
  }, [load])

  return { ...state, retry: () => load() }
}

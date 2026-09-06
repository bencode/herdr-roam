import type { ProjectWorkspace } from '@herdr-roam/shared'
import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchProjectWorkspaces, WorkspaceClientError } from './workspace-client'

export type ProjectWorkspaceState = {
  readonly items: readonly ProjectWorkspace[]
  readonly loading: boolean
  readonly error: WorkspaceClientError | null
  readonly retry: () => void
}

const initialState: Omit<ProjectWorkspaceState, 'retry'> = {
  items: [],
  loading: true,
  error: null,
}

const clientError = (error: unknown): WorkspaceClientError =>
  error instanceof WorkspaceClientError
    ? error
    : new WorkspaceClientError('network_error', 'Project Workspaces could not be loaded.', {
        cause: error,
      })

export const useProjectWorkspaces = (projectName: string): ProjectWorkspaceState => {
  const [state, setState] = useState({ projectName, value: initialState })
  const pending = useRef<AbortController | null>(null)

  const load = useCallback(() => {
    pending.current?.abort()
    const controller = new AbortController()
    pending.current = controller
    setState(current => ({
      projectName,
      value: {
        ...(current.projectName === projectName ? current.value : initialState),
        loading: true,
        error: null,
      },
    }))
    void fetchProjectWorkspaces(projectName, controller.signal).then(
      value => {
        if (controller.signal.aborted) return
        setState({ projectName, value: { items: value.items, loading: false, error: null } })
      },
      error => {
        if (controller.signal.aborted) return
        setState({ projectName, value: { items: [], loading: false, error: clientError(error) } })
      },
    )
  }, [projectName])

  useEffect(() => {
    load()
    return () => pending.current?.abort()
  }, [load])

  return { ...(state.projectName === projectName ? state.value : initialState), retry: load }
}

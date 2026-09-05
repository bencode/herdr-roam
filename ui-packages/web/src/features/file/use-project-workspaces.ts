import type { ProjectWorkspace } from '@herdr-roam/shared'
import { useCallback, useEffect, useRef, useState } from 'react'
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

import type { ProjectFileView } from '@herdr-roam/shared'
import { useCallback, useEffect, useRef, useState } from 'react'
import { FileClientError, fetchProjectFile } from './client'

type State = {
  readonly value: ProjectFileView | null
  readonly loading: boolean
  readonly error: FileClientError | null
}

const clientError = (error: unknown): FileClientError =>
  error instanceof FileClientError
    ? error
    : new FileClientError('network_error', 'The file could not be loaded.', { cause: error })

export const useFileView = (
  projectName: string,
  workspaceId: string,
  path: string,
  active: boolean,
) => {
  const [state, setState] = useState<State>({ value: null, loading: false, error: null })
  const wasActive = useRef(false)

  const load = useCallback(
    (signal?: AbortSignal) => {
      if (!active) {
        wasActive.current = false
        return
      }
      const shouldClear = !wasActive.current
      wasActive.current = true
      setState(current => ({
        value: shouldClear ? null : current.value,
        loading: true,
        error: null,
      }))
      void fetchProjectFile(projectName, workspaceId, path, signal).then(
        value => {
          if (!signal?.aborted) setState({ value, loading: false, error: null })
        },
        error => {
          if (signal?.aborted || (error instanceof DOMException && error.name === 'AbortError'))
            return
          setState({ value: null, loading: false, error: clientError(error) })
        },
      )
    },
    [active, path, projectName, workspaceId],
  )

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [load])

  const reload = useCallback(() => load(), [load])
  return { ...state, reload }
}

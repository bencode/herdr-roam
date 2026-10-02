import type { ProjectFileEntry } from '@herdr-roam/shared'
import { useCallback, useEffect, useRef, useState } from 'react'
import { FileClientError, searchProjectFiles } from './client'

type SearchState = {
  readonly items: readonly ProjectFileEntry[]
  readonly searching: boolean
  readonly truncated: boolean
  readonly error: FileClientError | null
}

const idleState: SearchState = { items: [], searching: false, truncated: false, error: null }

const asClientError = (error: unknown): FileClientError =>
  error instanceof FileClientError
    ? error
    : new FileClientError('network_error', 'Project files could not be searched.', {
        cause: error,
      })

export const useFileSearch = ({
  projectName,
  workspaceId,
  query,
}: {
  readonly projectName: string
  readonly workspaceId: string
  readonly query: string
}) => {
  const [state, setState] = useState<SearchState>(idleState)
  const controllerRef = useRef<AbortController | null>(null)
  const normalizedQuery = query.trim()

  const start = useCallback(() => {
    controllerRef.current?.abort()
    if (!normalizedQuery) {
      setState(idleState)
      return
    }
    const controller = new AbortController()
    controllerRef.current = controller
    let pending: ProjectFileEntry[] = []
    let frame: number | null = null
    const flush = () => {
      if (frame !== null) cancelAnimationFrame(frame)
      frame = null
      const batch = pending
      pending = []
      setState(current => ({ ...current, items: [...current.items, ...batch] }))
    }
    controller.signal.addEventListener('abort', () => {
      if (frame !== null) cancelAnimationFrame(frame)
    })
    setState({ ...idleState, searching: true })
    searchProjectFiles(projectName, workspaceId, normalizedQuery, {
      signal: controller.signal,
      onMatch: entry => {
        pending.push(entry)
        frame ??= requestAnimationFrame(flush)
      },
    }).then(
      ({ truncated }) => {
        flush()
        setState(current => ({ ...current, searching: false, truncated }))
      },
      error => {
        if (controller.signal.aborted) return
        flush()
        setState(current => ({ ...current, searching: false, error: asClientError(error) }))
      },
    )
  }, [normalizedQuery, projectName, workspaceId])

  useEffect(() => {
    start()
    return () => controllerRef.current?.abort()
  }, [start])

  return { ...state, retry: start }
}

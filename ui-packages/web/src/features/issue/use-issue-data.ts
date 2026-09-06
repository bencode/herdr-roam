import type { IssueCatalog, IssueDetail } from '@herdr-roam/shared'
import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchIssue, fetchIssues, IssueClientError } from './client'

const emptyCatalog: IssueCatalog = { items: [], warnings: [] }

const clientError = (error: unknown): IssueClientError =>
  error instanceof IssueClientError
    ? error
    : new IssueClientError('network_error', 'Issue data could not be loaded.', { cause: error })

const useIssueRequest = <Value>(
  key: string,
  enabled: boolean,
  initialValue: Value,
  request: (signal: AbortSignal) => Promise<Value>,
) => {
  const [state, setState] = useState({
    key,
    value: initialValue,
    loading: enabled,
    error: null as IssueClientError | null,
  })
  const pending = useRef<AbortController | null>(null)

  const load = useCallback(() => {
    if (!enabled) return
    pending.current?.abort()
    const controller = new AbortController()
    pending.current = controller
    setState(current => ({
      key,
      value: current.key === key ? current.value : initialValue,
      loading: true,
      error: null,
    }))
    void request(controller.signal).then(
      value => {
        if (!controller.signal.aborted) setState({ key, value, loading: false, error: null })
      },
      error => {
        if (!controller.signal.aborted) {
          setState(current => ({
            key,
            value: current.key === key ? current.value : initialValue,
            loading: false,
            error: clientError(error),
          }))
        }
      },
    )
  }, [enabled, initialValue, key, request])

  useEffect(() => {
    load()
    return () => pending.current?.abort()
  }, [load])

  const current =
    state.key === key ? state : { key, value: initialValue, loading: enabled, error: null }
  return { value: current.value, loading: current.loading, error: current.error, reload: load }
}

export const useIssueCatalog = (projectName: string, workspaceId: string) => {
  const request = useCallback(
    (signal: AbortSignal) => fetchIssues(projectName, workspaceId, signal),
    [projectName, workspaceId],
  )
  return useIssueRequest(`${projectName}:${workspaceId}`, true, emptyCatalog, request)
}

export const useIssueDetail = (
  projectName: string,
  workspaceId: string,
  issueId: string,
  active: boolean,
) => {
  const request = useCallback(
    (signal: AbortSignal) => fetchIssue(projectName, workspaceId, issueId, signal),
    [issueId, projectName, workspaceId],
  )
  return useIssueRequest<IssueDetail | null>(
    `${projectName}:${workspaceId}:${issueId}`,
    active,
    null,
    request,
  )
}

import type { FileView, SkillDetail } from '@herdr-roam/shared'
import { useCallback, useEffect, useRef, useState } from 'react'
import { type ResourceRef, resourceKey } from '../../workbench/resource'
import { fetchSkillDetail, fetchSkillFile, SkillClientError } from './client'

type SkillResource = Extract<ResourceRef, { type: 'skill' }>
type State<Value> = {
  readonly requestKey: string
  readonly value: Value | null
  readonly loading: boolean
  readonly error: SkillClientError | null
}

const clientError = (error: unknown): SkillClientError =>
  error instanceof SkillClientError
    ? error
    : new SkillClientError('network_error', 'Skill content could not be loaded.', { cause: error })

const useSkillRequest = <Value>(
  requestKey: string,
  loadValue: (signal?: AbortSignal) => Promise<Value>,
) => {
  const [state, setState] = useState<State<Value>>({
    requestKey,
    value: null,
    loading: true,
    error: null,
  })
  const sequence = useRef(0)
  const load = useCallback(
    (signal?: AbortSignal) => {
      const request = ++sequence.current
      setState(current => ({
        requestKey,
        value: current.requestKey === requestKey ? current.value : null,
        loading: true,
        error: null,
      }))
      void loadValue(signal).then(
        value => {
          if (!signal?.aborted && request === sequence.current) {
            setState({ requestKey, value, loading: false, error: null })
          }
        },
        error => {
          if (signal?.aborted || (error instanceof DOMException && error.name === 'AbortError'))
            return
          if (request === sequence.current) {
            setState({ requestKey, value: null, loading: false, error: clientError(error) })
          }
        },
      )
    },
    [loadValue, requestKey],
  )
  useEffect(() => {
    const controller = new AbortController()
    setState({ requestKey, value: null, loading: true, error: null })
    load(controller.signal)
    return () => controller.abort()
  }, [load, requestKey])
  const visible =
    state.requestKey === requestKey
      ? state
      : { requestKey, value: null, loading: true, error: null }
  return { ...visible, reload: () => load() }
}

export const useSkillDetail = (resource: SkillResource) =>
  useSkillRequest<SkillDetail>(
    resourceKey(resource),
    useCallback(signal => fetchSkillDetail(resource, signal), [resource]),
  )

export const useSkillFile = (resource: SkillResource, path: string | null) =>
  useSkillRequest<FileView | null>(
    `${resourceKey(resource)}:${path ?? 'overview'}`,
    useCallback(
      signal => (path ? fetchSkillFile(resource, path, signal) : Promise.resolve(null)),
      [path, resource],
    ),
  )

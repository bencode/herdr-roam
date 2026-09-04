import type { FileEntry } from '@herdr-roam/shared'
import { useCallback, useEffect, useRef, useState } from 'react'
import { type ResourceRef, resourceKey } from '../../workbench/resource'
import { fetchSkillFiles, SkillClientError } from './client'

type SkillResource = Extract<ResourceRef, { type: 'skill' }>
type State = {
  readonly requestKey: string
  readonly items: readonly FileEntry[]
  readonly total: number
  readonly nextCursor: string | null
  readonly loading: boolean
  readonly error: SkillClientError | null
}

const emptyState = (requestKey: string): State => ({
  requestKey,
  items: [],
  total: 0,
  nextCursor: null,
  loading: true,
  error: null,
})

export const useSkillFiles = (resource: SkillResource, directory: string, revision: number) => {
  const requestKey = `${resourceKey(resource)}:${directory}`
  const [state, setState] = useState<State>(emptyState(requestKey))
  const sequence = useRef(0)
  const load = useCallback(
    (cursor?: string, signal?: AbortSignal) => {
      const request = ++sequence.current
      setState(current => ({
        ...(current.requestKey === requestKey ? current : emptyState(requestKey)),
        loading: true,
        error: null,
      }))
      void fetchSkillFiles(resource, { directory, cursor, signal }).then(
        page => {
          if (signal?.aborted || request !== sequence.current) return
          setState(current => ({
            requestKey,
            items: cursor ? [...current.items, ...page.items] : page.items,
            total: page.total,
            nextCursor: page.nextCursor,
            loading: false,
            error: null,
          }))
        },
        error => {
          if (signal?.aborted || (error instanceof DOMException && error.name === 'AbortError'))
            return
          if (request !== sequence.current) return
          setState(current => ({
            ...current,
            loading: false,
            error:
              error instanceof SkillClientError
                ? error
                : new SkillClientError('network_error', 'Skill files could not be loaded.', {
                    cause: error,
                  }),
          }))
        },
      )
    },
    [directory, requestKey, resource],
  )

  useEffect(() => {
    const controller = new AbortController()
    setState(emptyState(requestKey))
    void revision
    load(undefined, controller.signal)
    return () => controller.abort()
  }, [load, requestKey, revision])

  const visible = state.requestKey === requestKey ? state : emptyState(requestKey)
  return {
    ...visible,
    loadMore: () => {
      if (!visible.loading && visible.nextCursor) load(visible.nextCursor)
    },
    retry: () => load(),
  }
}

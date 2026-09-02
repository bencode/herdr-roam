import type {
  SessionActivityUpdate,
  SessionCatalog,
  SessionEntry,
  SessionHistoryPage,
  SessionProvider,
} from '@herdr-roam/shared'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  fetchProjectSessions,
  fetchSessionDelta,
  fetchSessionPage,
  SessionClientError,
} from './client'

const EMPTY_CATALOG: SessionCatalog = { items: [], total: 0, nextCursor: null }
const SEARCH_DEBOUNCE_MS = 300
const LIVE_POLL_MS = 1_000
const MAX_VISIBLE_ENTRIES = 200
const MAX_VISIBLE_CONTENT_BYTES = 512 * 1024

type LoadState<Value> = {
  readonly value: Value
  readonly loading: boolean
  readonly error: SessionClientError | null
}

const clientError = (error: unknown, message: string): SessionClientError =>
  error instanceof SessionClientError
    ? error
    : new SessionClientError('network_error', message, null, { cause: error })

const aborted = (error: unknown): boolean =>
  error instanceof DOMException && error.name === 'AbortError'

export type ProjectSessionsState = LoadState<SessionCatalog> & {
  readonly page: number
  readonly hasNewer: boolean
  readonly older: () => void
  readonly newer: () => void
}

type CatalogPaging = {
  readonly projectName: string
  readonly query: string
  readonly limit: number
  readonly cursors: readonly (string | undefined)[]
}

export const useProjectSessions = (
  projectName: string,
  options: { readonly query?: string; readonly limit?: number } = {},
): ProjectSessionsState => {
  const query = options.query ?? ''
  const limit = options.limit ?? 50
  const [state, setState] = useState<LoadState<SessionCatalog>>({
    value: EMPTY_CATALOG,
    loading: true,
    error: null,
  })
  const [paging, setPaging] = useState<CatalogPaging>({
    projectName,
    query,
    limit,
    cursors: [undefined],
  })
  const pagingMatches =
    paging.projectName === projectName && paging.query === query && paging.limit === limit
  const cursors = pagingMatches ? paging.cursors : [undefined]
  const cursor = cursors.at(-1)

  useEffect(
    () => setPaging({ projectName, query, limit, cursors: [undefined] }),
    [projectName, query, limit],
  )

  useEffect(() => {
    const controller = new AbortController()
    const timeout = window.setTimeout(
      () => {
        setState(current => ({ ...current, loading: true, error: null }))
        fetchProjectSessions(projectName, { cursor, limit, query, signal: controller.signal }).then(
          catalog => setState({ value: catalog, loading: false, error: null }),
          error => {
            if (aborted(error)) return
            console.error('Session catalog request failed', error)
            setState(current => ({
              ...current,
              loading: false,
              error: clientError(error, 'Sessions could not be loaded.'),
            }))
          },
        )
      },
      query.trim() ? SEARCH_DEBOUNCE_MS : 0,
    )
    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [cursor, limit, projectName, query])

  const older = useCallback(() => {
    setPaging(current =>
      state.value.nextCursor
        ? { ...current, cursors: [...current.cursors, state.value.nextCursor] }
        : current,
    )
  }, [state.value.nextCursor])
  const newer = useCallback(
    () =>
      setPaging(current => ({
        ...current,
        cursors: current.cursors.length > 1 ? current.cursors.slice(0, -1) : current.cursors,
      })),
    [],
  )

  return { ...state, page: cursors.length, hasNewer: cursors.length > 1, older, newer }
}

const patchedEntry = (
  entry: SessionEntry,
  updates: ReadonlyMap<string, SessionActivityUpdate>,
): SessionEntry => {
  if (entry.kind !== 'activity') return entry
  const update = updates.get(entry.id)
  return update ? { ...entry, status: update.status, output: update.output } : entry
}

const mergeDelta = (
  page: SessionHistoryPage,
  entries: readonly SessionEntry[],
  activityUpdates: readonly SessionActivityUpdate[],
  tailCursor: string,
): SessionHistoryPage => {
  const updates = new Map(activityUpdates.map(update => [update.id, update]))
  const existing = new Set(page.entries.map(entry => entry.id))
  return {
    ...page,
    entries: [
      ...page.entries.map(entry => patchedEntry(entry, updates)),
      ...entries.filter(entry => !existing.has(entry.id)),
    ],
    tailCursor,
  }
}

const entryBytes = (entry: SessionEntry): number => {
  if (entry.kind === 'message') return new TextEncoder().encode(entry.text).byteLength
  if (entry.kind === 'activity') {
    return new TextEncoder().encode(`${entry.input ?? ''}${entry.output ?? ''}`).byteLength
  }
  return 64
}

const pageOverflowed = (page: SessionHistoryPage): boolean =>
  page.entries.length > MAX_VISIBLE_ENTRIES ||
  page.entries.reduce((total, entry) => total + entryBytes(entry), 0) > MAX_VISIBLE_CONTENT_BYTES

export type SessionNavigation = 'initial' | 'older' | 'newer' | 'latest'

export type SessionDataState = LoadState<SessionHistoryPage | null> & {
  readonly navigation: SessionNavigation
  readonly hasNewer: boolean
  readonly loadOlder: () => void
  readonly loadNewer: () => void
  readonly loadLatest: () => void
  readonly reload: () => void
}

type SessionPaging = {
  readonly projectName: string
  readonly provider: SessionProvider
  readonly sessionId: string
  readonly cursors: readonly (string | undefined)[]
  readonly navigation: SessionNavigation
}

export const useSessionData = (
  projectName: string,
  provider: SessionProvider,
  sessionId: string,
  live: boolean,
): SessionDataState => {
  const [state, setState] = useState<LoadState<SessionHistoryPage | null>>({
    value: null,
    loading: true,
    error: null,
  })
  const [paging, setPaging] = useState<SessionPaging>({
    projectName,
    provider,
    sessionId,
    cursors: [undefined],
    navigation: 'initial',
  })
  const [revision, setRevision] = useState(0)
  const revisionRef = useRef(revision)
  revisionRef.current = revision
  const pageRef = useRef(state.value)
  pageRef.current = state.value
  const pagingMatches =
    paging.projectName === projectName &&
    paging.provider === provider &&
    paging.sessionId === sessionId
  const cursors = pagingMatches ? paging.cursors : [undefined]
  const navigation = pagingMatches ? paging.navigation : 'initial'
  const cursor = cursors.at(-1)
  const atLatest = state.value?.atLatest === true

  useEffect(
    () =>
      setPaging({
        projectName,
        provider,
        sessionId,
        cursors: [undefined],
        navigation: 'initial',
      }),
    [projectName, provider, sessionId],
  )

  useEffect(() => {
    const controller = new AbortController()
    const requestRevision = revision
    setState(current => ({ ...current, loading: true, error: null }))
    fetchSessionPage(projectName, provider, sessionId, cursor, controller.signal).then(
      page => {
        if (requestRevision !== revisionRef.current) return
        setState({ value: page, loading: false, error: null })
      },
      error => {
        if (aborted(error) || requestRevision !== revisionRef.current) return
        console.error('Session detail request failed', error)
        if (error instanceof SessionClientError && error.code === 'session_history_changed') {
          setPaging(current => ({ ...current, cursors: [undefined], navigation: 'latest' }))
        }
        setState(current => ({
          ...current,
          loading: false,
          error: clientError(error, 'Session history could not be loaded.'),
        }))
      },
    )
    return () => controller.abort()
  }, [cursor, projectName, provider, revision, sessionId])

  useEffect(() => {
    const page = pageRef.current
    if (!live || !atLatest || !page || state.loading) return
    const controller = new AbortController()
    let active = true
    let timeout = 0
    let tailCursor = page.tailCursor

    const poll = (delay: number) => {
      timeout = window.setTimeout(async () => {
        try {
          const delta = await fetchSessionDelta(
            projectName,
            provider,
            sessionId,
            tailCursor,
            controller.signal,
          )
          if (!active) return
          tailCursor = delta.tailCursor
          let overflowed = false
          setState(current => {
            if (!current.value?.atLatest) return current
            const value = mergeDelta(
              current.value,
              delta.entries,
              delta.activityUpdates,
              delta.tailCursor,
            )
            overflowed = pageOverflowed(value)
            return { value, loading: false, error: null }
          })
          if (overflowed) {
            setRevision(value => value + 1)
            return
          }
          poll(delta.caughtUp ? LIVE_POLL_MS : 0)
        } catch (error) {
          if (!active || aborted(error)) return
          console.error('Session delta request failed', error)
          if (error instanceof SessionClientError && error.code === 'session_history_changed') {
            setRevision(value => value + 1)
            return
          }
          setState(current => ({
            ...current,
            error: clientError(error, 'Live Session updates could not be loaded.'),
          }))
          poll(LIVE_POLL_MS)
        }
      }, delay)
    }
    poll(LIVE_POLL_MS)
    return () => {
      active = false
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [atLatest, live, projectName, provider, sessionId, state.loading])

  const loadOlder = useCallback(() => {
    const olderCursor = state.value?.olderCursor
    if (!olderCursor) return
    setPaging(current => ({
      ...current,
      navigation: 'older',
      cursors: [...current.cursors, olderCursor],
    }))
  }, [state.value?.olderCursor])
  const loadNewer = useCallback(() => {
    setPaging(current => ({
      ...current,
      navigation: 'newer',
      cursors: current.cursors.length > 1 ? current.cursors.slice(0, -1) : current.cursors,
    }))
  }, [])
  const loadLatest = useCallback(() => {
    setPaging(current => ({ ...current, navigation: 'latest', cursors: [undefined] }))
  }, [])
  const reload = useCallback(() => setRevision(value => value + 1), [])

  return {
    ...state,
    navigation,
    hasNewer: cursors.length > 1,
    loadOlder,
    loadNewer,
    loadLatest,
    reload,
  }
}

import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchProjectSessions, fetchSessionDelta, fetchSessionPage, resumeSession } from './client'

afterEach(() => vi.restoreAllMocks())

const summary = {
  id: 'session-1',
  provider: 'codex' as const,
  title: 'Review release',
  cwd: '/work/herdr-roam',
  createdAt: null,
  updatedAt: '2026-09-01T09:00:00.000Z',
}

describe('Session API client', () => {
  it('reads catalogs and histories from encoded Project routes', async () => {
    const catalog = { items: [summary], total: 1, nextCursor: null }
    const page = {
      ...summary,
      mode: 'page',
      entries: [],
      olderCursor: null,
      tailCursor: 'tail-1',
      atLatest: true,
    }
    const delta = {
      mode: 'delta',
      entries: [],
      activityUpdates: [],
      tailCursor: 'tail-2',
      caughtUp: true,
    }
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(catalog), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(page), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(delta), { status: 200 }))

    await expect(
      fetchProjectSessions('roam project', { limit: 50, query: 'release' }),
    ).resolves.toEqual(catalog)
    await expect(
      fetchSessionPage('roam project', 'codex', 'session-1', 'older-1'),
    ).resolves.toEqual(page)
    await expect(
      fetchSessionDelta('roam project', 'codex', 'session-1', 'tail-1'),
    ).resolves.toEqual(delta)
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      '/api/projects/roam%20project/sessions?limit=50&query=release',
      { signal: undefined },
    )
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      '/api/projects/roam%20project/sessions/codex/session-1?before=older-1',
      { signal: undefined },
    )
    expect(fetch).toHaveBeenNthCalledWith(
      3,
      '/api/projects/roam%20project/sessions/codex/session-1?after=tail-1',
      { signal: undefined },
    )
  })

  it('resumes a Session and preserves structured API errors', async () => {
    const receipt = {
      reused: false,
      agent: {
        id: 'terminal-1',
        name: 'codex-herdr-roam',
        provider: 'codex',
        status: 'idle',
        cwd: '/work/herdr-roam',
        attachTarget: 'w1:p1',
        session: { source: 'process', agent: 'codex', kind: 'id', value: 'session-1' },
      },
    }
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(receipt), { status: 201 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: { code: 'session_directory_unavailable', message: 'cwd is missing' },
          }),
          { status: 409 },
        ),
      )

    await expect(resumeSession('herdr-roam', 'codex', 'session-1')).resolves.toEqual(receipt)
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      '/api/projects/herdr-roam/sessions/codex/session-1/resume',
      { method: 'POST' },
    )
    await expect(resumeSession('herdr-roam', 'codex', 'session-1')).rejects.toMatchObject({
      code: 'session_directory_unavailable',
      message: 'cwd is missing',
    })
  })
})

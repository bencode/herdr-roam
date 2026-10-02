import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  type FileClientError,
  fetchProjectFile,
  fetchProjectFiles,
  projectFileRawUrl,
  searchProjectFiles,
} from './client'

afterEach(() => vi.unstubAllGlobals())

describe('Project file client', () => {
  it('encodes Project names, paths, and pagination queries', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ items: [], total: 0, nextCursor: null }), { status: 200 }),
      )
    vi.stubGlobal('fetch', fetchMock)

    await fetchProjectFiles('my project', 'primary', {
      directory: 'docs/design',
      cursor: 'next page',
    })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/projects/my%20project/workspaces/primary/files?directory=docs%2Fdesign&cursor=next+page',
      { signal: undefined },
    )
    expect(projectFileRawUrl('my project', 'primary', 'images/space mark.png')).toBe(
      '/api/projects/my%20project/workspaces/primary/files/raw/images/space%20mark.png',
    )
  })

  it('preserves structured server errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ error: { code: 'file_not_found', message: 'File not found.' } }),
            { status: 404 },
          ),
        ),
    )

    await expect(fetchProjectFile('fixture', 'primary', 'missing.md')).rejects.toMatchObject({
      name: 'FileClientError',
      code: 'file_not_found',
      message: 'File not found.',
    } satisfies Partial<FileClientError>)
  })

  it('reads streamed search events split across chunks', async () => {
    const encoder = new TextEncoder()
    const body = new ReadableStream<Uint8Array>({
      start: controller => {
        controller.enqueue(
          encoder.encode('{"type":"match","entry":{"kind":"file","name":"a.md","pa'),
        )
        controller.enqueue(encoder.encode('th":"docs/a.md"}}\n{"type":"done","truncated":false}\n'))
        controller.close()
      },
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { status: 200 })))
    const onMatch = vi.fn()

    await expect(searchProjectFiles('fixture', 'primary', 'a', { onMatch })).resolves.toEqual({
      truncated: false,
    })
    expect(onMatch).toHaveBeenCalledExactlyOnceWith({
      kind: 'file',
      name: 'a.md',
      path: 'docs/a.md',
    })
  })
})

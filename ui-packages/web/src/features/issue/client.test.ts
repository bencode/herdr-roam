import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchIssue, fetchIssues, type IssueClientError } from './client'

const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

afterEach(() => vi.unstubAllGlobals())

describe('Issue client', () => {
  it('encodes the selected Workspace and validates Issue data', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [{ id, title: 'Release', status: 'open', labels: [], path: `issues/${id}.md` }],
          warnings: [],
        }),
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchIssues('my project', 'feature/work')).resolves.toMatchObject({
      items: [{ id, title: 'Release' }],
    })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/projects/my%20project/workspaces/feature%2Fwork/issues',
      { signal: undefined },
    )
  })

  it('preserves structured errors and rejects malformed success responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              error: {
                code: 'issue_store_not_configured',
                message: 'Issue store is not configured.',
              },
            }),
            { status: 404 },
          ),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              error: {
                code: 'workspace_unavailable',
                message: 'Git Workspaces are unavailable.',
              },
            }),
            { status: 503 },
          ),
        )
        .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'not-a-uuid' }))),
    )

    await expect(fetchIssues('fixture', 'primary')).rejects.toMatchObject({
      code: 'issue_store_not_configured',
    } satisfies Partial<IssueClientError>)
    await expect(fetchIssues('fixture', 'primary')).rejects.toMatchObject({
      code: 'workspace_unavailable',
    } satisfies Partial<IssueClientError>)
    await expect(fetchIssue('fixture', 'primary', id)).rejects.toMatchObject({
      code: 'invalid_response',
    } satisfies Partial<IssueClientError>)
  })
})

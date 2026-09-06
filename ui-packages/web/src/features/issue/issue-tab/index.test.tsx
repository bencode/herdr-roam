import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchIssue } from '../client'
import { IssueTab } from '.'

const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

vi.mock('../client', () => ({
  fetchIssue: vi.fn(() =>
    Promise.resolve({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      title: 'Prepare release',
      status: 'open' as const,
      type: 'task' as const,
      priority: 'p0' as const,
      labels: ['release'],
      path: 'docs/issues/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.md',
      body: '- [ ] Verify release\n- [x] Integrate Issues\n',
    }),
  ),
  fetchIssues: vi.fn(),
  IssueClientError: class IssueClientError extends Error {},
}))

beforeEach(() => vi.clearAllMocks())

describe('Issue tab', () => {
  it('renders the Markdown source as a read-only Issue and refreshes explicitly', async () => {
    render(
      <IssueTab
        resource={{ type: 'issue', projectName: 'herdr-roam', workspaceId: 'primary', issueId: id }}
        active
      />,
    )

    expect(await screen.findByRole('heading', { name: 'Prepare release' })).toBeVisible()
    expect(screen.getByText('p0')).toBeVisible()
    expect(screen.getByText('release')).toBeVisible()
    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes).toHaveLength(2)
    expect(checkboxes.every(checkbox => checkbox.hasAttribute('disabled'))).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Refresh Issue' }))
    await waitFor(() => expect(fetchIssue).toHaveBeenCalledTimes(2))
    expect(fetchIssue).toHaveBeenLastCalledWith('herdr-roam', 'primary', id, expect.anything())
  })
})

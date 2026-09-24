import type { ProjectFileView } from '@herdr-roam/shared'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FileTab } from '.'

const binary: ProjectFileView = {
  kind: 'binary',
  path: 'dist/app.bin',
  name: 'app.bin',
  size: 2048,
  modifiedAt: '2026-09-01T00:00:00.000Z',
  mediaType: 'application/octet-stream',
}

const view = vi.hoisted(() => ({ value: null as ProjectFileView | null, reload: vi.fn() }))

vi.mock('../use-file-view', () => ({
  useFileView: () => ({ value: view.value, loading: false, error: null, reload: view.reload }),
}))

const renderTab = (path: string) =>
  render(
    <FileTab
      resource={{ type: 'file', projectName: 'fixture', workspaceId: 'primary', path }}
      active
      onOpen={vi.fn()}
    />,
  )

describe('FileTab', () => {
  beforeEach(() => {
    view.value = binary
    view.reload.mockClear()
  })

  it('shows file identity and offers an explicit refresh', () => {
    renderTab('dist/app.bin')

    expect(screen.getByText('dist/app.bin')).toBeVisible()
    expect(screen.getByText(/2.0 KiB/)).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Refresh file' }))
    expect(view.reload).toHaveBeenCalledOnce()
  })

  it('switches a Markdown file between preview and source from the header', async () => {
    view.value = {
      kind: 'markdown',
      path: 'docs/guide.md',
      name: 'guide.md',
      size: 32,
      modifiedAt: '2026-09-01T00:00:00.000Z',
      mediaType: 'text/markdown',
      language: 'markdown',
      content: '# Guide',
    }
    renderTab('docs/guide.md')

    expect(await screen.findByRole('heading', { name: 'Guide' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'source' }))
    expect(await screen.findByRole('region', { name: 'markdown source' })).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Guide' })).not.toBeInTheDocument()
  })
})

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FileTab } from '.'

const reload = vi.hoisted(() => vi.fn())

vi.mock('../use-file-view', () => ({
  useFileView: () => ({
    value: {
      kind: 'binary' as const,
      path: 'dist/app.bin',
      name: 'app.bin',
      size: 2048,
      modifiedAt: '2026-09-01T00:00:00.000Z',
      mediaType: 'application/octet-stream',
    },
    loading: false,
    error: null,
    reload,
  }),
}))

describe('FileTab', () => {
  it('shows file identity and offers an explicit refresh', () => {
    render(
      <FileTab
        resource={{
          type: 'file',
          projectName: 'fixture',
          workspaceId: 'primary',
          path: 'dist/app.bin',
        }}
        active
        onOpen={vi.fn()}
      />,
    )

    expect(screen.getByText('dist/app.bin')).toBeVisible()
    expect(screen.getByText(/2.0 KiB/)).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Refresh file' }))
    expect(reload).toHaveBeenCalledOnce()
  })
})

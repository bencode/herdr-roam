import type { ProjectFileView } from '@herdr-roam/shared'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FileReader } from '.'

const markdown: ProjectFileView = {
  kind: 'markdown',
  path: 'docs/guide.md',
  name: 'guide.md',
  size: 32,
  modifiedAt: '2026-09-01T00:00:00.000Z',
  mediaType: 'text/markdown',
  language: 'markdown',
  content: '# Guide\n\n[Details](details.md)',
}

describe('FileReader', () => {
  it('opens relative Markdown links through the Workbench', async () => {
    const onOpenPath = vi.fn()
    render(<FileReader file={markdown} rawUrl={path => `/raw/${path}`} onOpenPath={onOpenPath} />)

    fireEvent.click(await screen.findByRole('link', { name: 'Details' }))
    expect(onOpenPath).toHaveBeenCalledWith('docs/details.md')
  })

  it('can omit the Markdown outline when another contents navigation is present', async () => {
    render(
      <FileReader
        file={markdown}
        rawUrl={path => `/raw/${path}`}
        onOpenPath={vi.fn()}
        showOutline={false}
      />,
    )

    await screen.findByRole('heading', { name: 'Guide' })
    expect(screen.queryByRole('navigation', { name: 'On this page' })).not.toBeInTheDocument()
  })

  it('hides YAML front matter from the Markdown preview', async () => {
    render(
      <FileReader
        file={{
          ...markdown,
          content: '---\nname: example\ndescription: Example skill\n---\n\n# Guide',
        }}
        rawUrl={path => `/raw/${path}`}
        onOpenPath={vi.fn()}
      />,
    )

    expect(await screen.findByRole('heading', { name: 'Guide' })).toBeVisible()
    expect(screen.queryByText(/name: example/)).not.toBeInTheDocument()
  })

  it('renders explicit fallback states for unsupported content', () => {
    render(
      <FileReader
        file={{ ...markdown, kind: 'binary' }}
        rawUrl={path => `/raw/${path}`}
        onOpenPath={vi.fn()}
      />,
    )

    expect(screen.getByText('This binary file cannot be previewed.')).toBeVisible()
  })

  it('isolates HTML previews in a scriptless sandbox', async () => {
    render(
      <FileReader
        file={{
          ...markdown,
          kind: 'html',
          name: 'page.html',
          path: 'docs/page.html',
          mediaType: 'text/html',
          language: 'html',
          content: '<h1>Local page</h1><script>window.parent.hacked = true</script>',
        }}
        rawUrl={path => `/raw/${path}`}
        onOpenPath={vi.fn()}
      />,
    )

    const frame = await screen.findByTitle('Preview of page.html')
    expect(frame).toHaveAttribute('sandbox', '')
    expect(frame).toHaveAttribute('srcdoc', expect.stringContaining("default-src 'none'"))
  })
})

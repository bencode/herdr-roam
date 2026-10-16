import type { ProjectFileView } from '@herdr-roam/shared'
import { fireEvent, render, screen, within } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { FileReader as ControlledFileReader } from '.'
import { MarkdownOutline } from './markdown-outline'
import { useMarkdownView } from './markdown-view'

const FileReader = (props: Omit<ComponentProps<typeof ControlledFileReader>, 'markdownView'>) => (
  <ControlledFileReader {...props} markdownView={useMarkdownView()} />
)

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

beforeAll(async () => {
  await Promise.all([import('./markdown-reader'), import('./code-reader')])
})

describe('FileReader', () => {
  it('opens relative Markdown links through the Workbench', async () => {
    const onOpenPath = vi.fn()
    render(<FileReader file={markdown} rawUrl={path => `/raw/${path}`} onOpenPath={onOpenPath} />)

    await screen.findByRole('link', { name: 'Details' })
    fireEvent.click(screen.getByRole('link', { name: 'Details' }))
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

  it('shows frontmatter properties with the document even without an outline', async () => {
    render(
      <FileReader
        file={{
          ...markdown,
          content: '---\nname: example\ndescription: Example skill\n---\n\n# Guide',
        }}
        rawUrl={path => `/raw/${path}`}
        onOpenPath={vi.fn()}
        showOutline={false}
      />,
    )

    expect(await screen.findByRole('heading', { name: 'Guide' })).toBeVisible()
    expect(screen.getByText('Properties · 2')).toBeVisible()
    expect(screen.getByText('name')).toBeVisible()
    expect(screen.getByText('example')).toBeVisible()
    expect(screen.getByText('Example skill')).toBeVisible()
    expect(screen.queryByText(/name: example/)).not.toBeInTheDocument()
  })

  it('folds properties and nested YAML and resets folding when the file changes', async () => {
    const content =
      '---\nowner: 魏琪君\nsources:\n- kind: mention\n  group: 软件工厂-测试\n---\n# Guide'
    const props = { rawUrl: (path: string) => `/raw/${path}`, onOpenPath: vi.fn() }
    const view = render(<FileReader {...props} file={{ ...markdown, content }} />)
    const summary = await screen.findByText('Properties · 2')
    const source = screen.getByText('软件工厂-测试')

    expect(screen.getByText('魏琪君')).toBeVisible()
    expect(screen.getByText('软件工厂-测试')).not.toBeVisible()
    fireEvent.click(screen.getByText('1 item'))
    expect(source).toBeVisible()
    view.rerender(<FileReader {...props} file={{ ...markdown, content }} />)
    expect(source).toBeVisible()
    fireEvent.click(summary)
    expect(screen.getByText('魏琪君')).not.toBeVisible()
    expect(screen.getByRole('heading', { name: 'Guide' })).toBeVisible()
    view.rerender(<FileReader {...props} file={{ ...markdown, path: 'other.md', content }} />)
    expect(screen.getByText('魏琪君')).toBeVisible()
    expect(screen.getByText('软件工厂-测试')).not.toBeVisible()
  })

  it('keeps malformed frontmatter visible alongside the rendered body', async () => {
    render(
      <FileReader
        file={{ ...markdown, content: '---\nname: [unfinished\n---\n# Guide' }}
        rawUrl={path => `/raw/${path}`}
        onOpenPath={vi.fn()}
      />,
    )

    expect(await screen.findByRole('heading', { name: 'Guide' })).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('Properties could not be displayed.')
    expect(
      screen.getByRole('region', { name: 'Document properties' }).querySelector('pre'),
    ).toHaveTextContent('name: [unfinished')
  })

  it('preserves the complete original document in source mode', async () => {
    const content = '---\nowner: 魏琪君\n---\n\n# Guide'
    const props = {
      file: { ...markdown, content },
      rawUrl: (path: string) => `/raw/${path}`,
      onOpenPath: vi.fn(),
    }
    const view = render(
      <ControlledFileReader
        {...props}
        markdownView={{
          mode: 'preview',
          setMode: vi.fn(),
          outlineOpen: false,
          setOutlineOpen: vi.fn(),
        }}
      />,
    )
    expect(await screen.findByText('Properties · 1')).toBeVisible()
    view.rerender(
      <ControlledFileReader
        {...props}
        markdownView={{
          mode: 'source',
          setMode: vi.fn(),
          outlineOpen: false,
          setOutlineOpen: vi.fn(),
        }}
      />,
    )

    const source = await screen.findByRole('region', { name: 'markdown source' })
    const code = source.querySelector('code')?.cloneNode(true)
    if (!(code instanceof HTMLElement)) throw new Error('Source code is missing')
    code.querySelectorAll('.linenumber').forEach(number => {
      number.remove()
    })
    expect(code.textContent).toBe(content)
    expect(screen.queryByText('Properties · 1')).not.toBeInTheDocument()
  })

  it('formats zoned timestamps and renders literal HTML, empty and falsy values as text', async () => {
    const timestamp = '2026-10-15T07:01:02.495184Z'
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Shanghai',
      dateStyle: 'medium',
      timeStyle: 'long',
    })
    const NativeDateTimeFormat = Intl.DateTimeFormat
    const format = vi
      .spyOn(Intl, 'DateTimeFormat')
      .mockImplementation(
        (locales, options) =>
          new NativeDateTimeFormat(locales ?? 'en-US', { ...options, timeZone: 'Asia/Shanghai' }),
      )
    try {
      render(
        <FileReader
          file={{
            ...markdown,
            content: `---\nupdated_at: '${timestamp}'\ndate: '2026-10-15'\nhtml: '<img src=x onerror=alert(1)>'\nempty: ""\nactive: false\nmissing: null\n---\n# Guide`,
          }}
          rawUrl={path => `/raw/${path}`}
          onOpenPath={vi.fn()}
        />,
      )
      const summary = await screen.findByText('Properties · 6')
      const properties = summary.closest('section')
      expect(properties).not.toBeNull()
      if (!properties) throw new Error('Properties region is missing')
      const timestampElement = within(properties).getByText(formatter.format(new Date(timestamp)))
      expect(timestampElement).toHaveAttribute('datetime', timestamp)
      expect(timestampElement).toHaveAttribute('title', timestamp)
      expect(within(properties).getByText('2026-10-15')).toBeVisible()
      expect(within(properties).getByText('<img src=x onerror=alert(1)>')).toBeVisible()
      expect(properties.querySelector('img')).toBeNull()
      expect(within(properties).getByText('""')).toBeVisible()
      expect(within(properties).getByText('false')).toBeVisible()
      expect(within(properties).getByText('null')).toBeVisible()
    } finally {
      format.mockRestore()
    }
  })

  it.each([
    ['# Guide\n\n[Details][details]\n\n[details]: details.md', true],
    ['An introduction.\n\n# Guide', false],
  ])(
    'places properties after an opening title without losing Markdown link definitions',
    async (body, titleFirst) => {
      render(
        <FileReader
          file={{ ...markdown, content: `---\nowner: 魏琪君\n---\n${body}` }}
          rawUrl={path => path}
          onOpenPath={vi.fn()}
        />,
      )
      const title = await screen.findByRole('heading', { name: 'Guide' })
      const properties = screen.getByRole('region', { name: 'Document properties' })
      expect(
        Boolean(title.compareDocumentPosition(properties) & Node.DOCUMENT_POSITION_FOLLOWING),
      ).toBe(titleFirst)
      if (titleFirst)
        expect(screen.getByRole('link', { name: 'Details' })).toHaveAttribute('href', 'details.md')
    },
  )

  it('navigates an outline drawer and closes it with selection or Escape', () => {
    const onSelect = vi.fn()
    const onClose = vi.fn()
    render(
      <MarkdownOutline
        headings={[
          { id: 'first', level: 2, label: 'First' },
          { id: 'next', level: 3, label: 'Next' },
        ]}
        activeId="first"
        variant="drawer"
        onSelect={onSelect}
        onClose={onClose}
      />,
    )
    expect(screen.getByRole('button', { name: 'First' })).toHaveAttribute(
      'aria-current',
      'location',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(onSelect).toHaveBeenCalledWith('next')
    expect(onClose).toHaveBeenCalledOnce()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
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

import type { CompareFileView, Comparison } from '@herdr-roam/shared'
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { type ReactNode, useLayoutEffect } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { fetchCompareBranches, fetchComparison, fetchComparisonFile } from './client'
import { ChangedFileTree, changedTree } from './changed-tree'
import { CompareTab } from './compare-tab'
import { useCompare } from './use-compare'

vi.mock('@pierre/diffs/react', () => ({
  WorkerPoolContextProvider: ({ children }: { children: ReactNode }) => children,
}))
vi.mock('./diff-view', () => ({
  DiffView: ({ file }: { file: Extract<CompareFileView, { kind: 'text' }> }) => (
    <div>{file.newFile?.content ?? file.oldFile?.content}</div>
  ),
}))
vi.mock('./client', () => ({
  fetchCompareBranches: vi.fn(),
  fetchComparison: vi.fn(),
  fetchComparisonFile: vi.fn(),
}))
vi.mock('../project/workspace-client', () => ({
  fetchProjectWorkspaces: vi.fn(async () => ({ items: [{ id: 'linked', branch: 'feature' }] })),
}))

const resource = { type: 'compare', projectName: 'fixture', workspaceId: 'linked' } as const
const source = { ref: 'refs/heads/feature', name: 'feature', oid: 'a'.repeat(40) }
const target = { ref: 'refs/heads/main', name: 'main', oid: 'b'.repeat(40) }
const result: Comparison = {
  source,
  target,
  baseOid: 'c'.repeat(40),
  files: [
    {
      oldPath: 'src/one.ts',
      newPath: 'src/one.ts',
      oldMode: '100644',
      newMode: '100644',
      status: 'modified',
      added: 1,
      removed: 1,
    },
    {
      oldPath: null,
      newPath: 'src/two.ts',
      oldMode: null,
      newMode: '100644',
      status: 'added',
      added: 2,
      removed: 0,
    },
  ],
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  vi.mocked(fetchCompareBranches).mockImplementation(async () => ({
    items: [source, target],
    defaultTargetRef: target.ref,
  }))
  vi.mocked(fetchComparison).mockImplementation(async () => ({ ...result }))
  vi.mocked(fetchComparisonFile).mockImplementation(async (_project, _base, _source, path) => ({
    kind: 'text',
    entry:
      result.files.find(file => file.newPath === path) ??
      (result.files[0] as Comparison['files'][number]),
    oldFile: null,
    newFile: { path, content: `Committed content: ${path}` },
  }))
})

it('uses the entry branch, navigates filtered files, and retains comparison on tab switches', async () => {
  const view = render(<CompareTab resource={resource} active />)
  expect(await screen.findByText('Committed content: src/one.ts')).toBeVisible()
  expect(fetchComparison).toHaveBeenCalledWith(
    'fixture',
    source.ref,
    target.ref,
    expect.any(AbortSignal),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Next changed file' }))
  expect(await screen.findByText('Committed content: src/two.ts')).toBeVisible()
  fireEvent.change(screen.getByRole('textbox', { name: 'Filter changed files' }), {
    target: { value: 'two' },
  })
  expect(screen.queryByRole('button', { name: /one.ts/ })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Next changed file' })).toBeDisabled()
  view.rerender(<CompareTab resource={resource} active={false} />)
  view.rerender(<CompareTab resource={resource} active />)
  expect(await screen.findByText('Committed content: src/two.ts')).toBeVisible()
  expect(fetchComparison).toHaveBeenCalledTimes(1)
  expect(fetchComparisonFile).toHaveBeenCalledTimes(2)
  fireEvent.click(screen.getByRole('button', { name: 'Refresh comparison' }))
  await waitFor(() => expect(fetchComparison).toHaveBeenCalledTimes(2))
  expect(await screen.findByText('Committed content: src/two.ts')).toBeVisible()
})

it('rejects obsolete responses when branches change and offers retry after file errors', async () => {
  let resolveOld: ((value: Comparison) => void) | undefined
  vi.mocked(fetchComparison).mockImplementationOnce(
    () =>
      new Promise(resolve => {
        resolveOld = resolve
      }),
  )
  render(<CompareTab resource={resource} active />)
  await waitFor(() => expect(fetchComparison).toHaveBeenCalledTimes(1))
  vi.mocked(fetchComparisonFile).mockRejectedValueOnce(new Error('File read failed.'))
  fireEvent.click(screen.getByRole('combobox', { name: 'Source branch' }))
  fireEvent.click(await screen.findByRole('option', { name: 'main' }))
  expect(await screen.findByText('File read failed.')).toBeVisible()
  resolveOld?.({ ...result, files: [] })
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  expect(await screen.findByText('Committed content: src/one.ts')).toBeVisible()
})

it('explains empty and unsupported comparisons and persists view preferences', async () => {
  vi.mocked(fetchComparisonFile).mockResolvedValue({
    kind: 'unavailable',
    entry: result.files[0] as Comparison['files'][number],
    reason: 'binary',
  })
  render(<CompareTab resource={resource} active />)
  expect(await screen.findByText('Binary files cannot be previewed.')).toBeVisible()
  fireEvent.click(screen.getByRole('radio', { name: 'Split' }))
  fireEvent.click(screen.getByRole('button', { name: 'Wrap long lines' }))
  expect(JSON.parse(localStorage.getItem('herdr-roam.compare.v1') ?? '{}')).toMatchObject({
    mode: 'split',
    wrap: true,
  })
  vi.mocked(fetchComparison).mockResolvedValue({ ...result, files: [] })
  fireEvent.click(screen.getByRole('button', { name: 'Refresh comparison' }))
  expect(await screen.findByText('No committed changes')).toBeVisible()
})

it('keeps the selected diff when hiding and restoring the resizable file tree', async () => {
  render(<CompareTab resource={resource} active />)
  expect(await screen.findByText('Committed content: src/one.ts')).toBeVisible()
  const diff = screen.getByText('Committed content: src/one.ts')
  expect(screen.getByRole('separator', { name: 'Resize changed files' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Hide changed files' }))
  expect(screen.queryByRole('navigation', { name: 'Changed files' })).not.toBeInTheDocument()
  expect(screen.getByText('Committed content: src/one.ts')).toBe(diff)
  fireEvent.click(screen.getByRole('button', { name: 'Show changed files' }))
  expect(screen.getByRole('navigation', { name: 'Changed files' })).toBeInTheDocument()
  expect(screen.getByRole('separator', { name: 'Resize changed files' })).toBeInTheDocument()
  expect(screen.getByText('Committed content: src/one.ts')).toBe(diff)
  expect(fetchComparisonFile).toHaveBeenCalledTimes(1)
})

it('encodes project-scoped API queries and validates response bodies', async () => {
  const client = await vi.importActual<typeof import('./client')>('./client')
  const request = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      kind: 'text',
      entry: result.files[0],
      oldFile: null,
      newFile: { path: '中文 &.ts', content: '' },
    }),
  })
  vi.stubGlobal('fetch', request)
  try {
    await client.fetchComparisonFile('project name', result.baseOid, source.oid, '中文 &.ts')
    const url = new URL(request.mock.calls[0]?.[0] as string, 'http://localhost')
    expect(url.pathname).toBe('/api/projects/project%20name/compare/file')
    expect(url.searchParams.get('path')).toBe('中文 &.ts')
    expect(url.searchParams.has('workspaceId')).toBe(false)
    request.mockResolvedValueOnce({ ok: true, json: async () => ({ invalid: true }) })
    await expect(client.fetchCompareBranches('fixture')).rejects.toMatchObject({
      code: 'invalid_response',
    })
  } finally {
    vi.unstubAllGlobals()
  }
})

it('never exposes the previous file under a newly selected path', async () => {
  const observed: { readonly selected: string; readonly content: string | null }[] = []
  const { result: controller } = renderHook(() => {
    const value = useCompare(resource.projectName, resource.workspaceId, true)
    useLayoutEffect(() => {
      if (value.file)
        observed.push({ selected: value.selectedPath, content: value.file.entry.newPath })
    }, [value.selectedPath, value.file])
    return value
  })
  await waitFor(() => expect(controller.current.comparison).not.toBeNull())
  act(() => controller.current.selectFile('src/one.ts'))
  await waitFor(() => expect(controller.current.file).not.toBeNull())
  act(() => controller.current.selectFile('src/two.ts'))
  await waitFor(() => expect(controller.current.file?.entry.newPath).toBe('src/two.ts'))
  expect(observed.some(value => value.content === 'src/one.ts')).toBe(true)
  expect(observed.every(value => value.selected === value.content)).toBe(true)
})

it.each([
  { reverse: false, childFirst: false },
  { reverse: false, childFirst: true },
  { reverse: true, childFirst: false },
  { reverse: true, childFirst: true },
])(
  'keeps every file navigable in a file/directory replacement: %j',
  async ({ reverse, childFirst }) => {
    const added = (path: string) =>
      ({
        oldPath: null,
        newPath: path,
        oldMode: null,
        newMode: '100644',
        status: 'added',
        added: 1,
        removed: 0,
      }) as const
    const deleted = (path: string) =>
      ({
        oldPath: path,
        newPath: null,
        oldMode: '100644',
        newMode: null,
        status: 'deleted',
        added: 0,
        removed: 1,
      }) as const
    const files = reverse
      ? [added('config'), deleted('config/app.ts')]
      : [deleted('config'), added('config/app.ts')]
    if (childFirst) files.reverse()
    vi.mocked(fetchComparison).mockResolvedValue({ ...result, files })
    vi.mocked(fetchComparisonFile).mockImplementation(async (_project, _base, _source, path) => {
      const entry = files.find(file => (file.newPath ?? file.oldPath) === path)
      if (!entry) throw new Error(`Missing fixture ${path}`)
      return {
        kind: 'text',
        entry,
        oldFile: entry.oldPath ? { path, content: `Old: ${path}` } : null,
        newFile: entry.newPath ? { path, content: `New: ${path}` } : null,
      }
    })
    const tree = changedTree(files, '')
    expect(new Set(tree.paths)).toEqual(new Set(['config', 'config/app.ts']))
    expect(tree.paths).toHaveLength(files.length)
    render(<CompareTab resource={resource} active />)
    expect(await screen.findByText(`${reverse ? 'Old' : 'New'}: config/app.ts`)).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Next changed file' }))
    expect(await screen.findByText(`${reverse ? 'New' : 'Old'}: config`)).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Previous changed file' }))
    expect(await screen.findByText(`${reverse ? 'Old' : 'New'}: config/app.ts`)).toBeVisible()
  },
)

it('reveals filtered matches inside a previously collapsed folder', () => {
  const files = result.files.map((entry, index) => ({
    ...entry,
    newPath: index ? 'src/sub/two.ts' : 'src/one.ts',
  }))
  const select = vi.fn()
  const view = (query: string, selectedPath = 'src/one.ts') => (
    <ChangedFileTree
      nodes={changedTree(files, query).nodes}
      query={query}
      selectedPath={selectedPath}
      onSelect={select}
    />
  )
  const rendered = render(view(''))
  fireEvent.click(screen.getByText('src'))
  expect(screen.getByTitle('src/sub/two.ts · added')).not.toBeVisible()
  rendered.rerender(view('two'))
  expect(screen.getByTitle('src/sub/two.ts · added')).toBeVisible()
  fireEvent.click(screen.getByTitle('src/sub/two.ts · added'))
  expect(select).toHaveBeenCalledWith('src/sub/two.ts')
  rendered.rerender(view(''))
  expect(screen.getByTitle('src/sub/two.ts · added')).toBeVisible()
  fireEvent.click(screen.getByText('src'))
  rendered.rerender(view('', 'src/sub/two.ts'))
  expect(screen.getByTitle('src/sub/two.ts · added')).toBeVisible()
})

it.each([false, true])(
  'shows mode and BOM changes without stale file details: removing BOM = %s',
  async removing => {
    const first = {
      ...result.files[0],
      oldMode: '100644',
      newMode: '100755',
    } as Comparison['files'][number]
    vi.mocked(fetchComparison).mockResolvedValue({
      ...result,
      files: [first, result.files[1] as Comparison['files'][number]],
    })
    vi.mocked(fetchComparisonFile).mockResolvedValueOnce({
      kind: 'text',
      entry: first,
      oldFile: { path: 'src/one.ts', content: `${removing ? '\uFEFF' : ''}before` },
      newFile: { path: 'src/one.ts', content: `${removing ? '' : '\uFEFF'}after` },
    })
    render(<CompareTab resource={resource} active />)
    expect(await screen.findByText(`UTF-8 BOM ${removing ? 'removed' : 'added'}`)).toBeVisible()
    expect(screen.getByText('File mode 100644 → 100755')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Next changed file' }))
    expect(screen.queryByText(/UTF-8 BOM/)).not.toBeInTheDocument()
    expect(screen.queryByText('File mode 100644 → 100755')).not.toBeInTheDocument()
    expect(await screen.findByText('Committed content: src/two.ts')).toBeVisible()
    expect(screen.getByText('New file mode 100644')).toBeVisible()
  },
)

it('keeps mode changes visible when content cannot be previewed', async () => {
  const entry = {
    ...result.files[0],
    oldMode: '100644',
    newMode: '100755',
  } as Comparison['files'][number]
  vi.mocked(fetchComparison).mockResolvedValue({ ...result, files: [entry] })
  vi.mocked(fetchComparisonFile).mockResolvedValue({ kind: 'unavailable', entry, reason: 'binary' })
  render(<CompareTab resource={resource} active />)
  expect(await screen.findByText('Binary files cannot be previewed.')).toBeVisible()
  expect(screen.getByText('File mode 100644 → 100755')).toBeVisible()
})

it('validates modes and restricts server error codes to the shared contract', async () => {
  const client = await vi.importActual<typeof import('./client')>('./client')
  const request = vi.fn()
  vi.stubGlobal('fetch', request)
  try {
    request.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...result, files: [{ ...result.files[0], newMode: '100999' }] }),
    })
    await expect(client.fetchComparison('fixture', source.ref, target.ref)).rejects.toMatchObject({
      code: 'invalid_response',
    })
    request.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: { code: 'ref_not_found', message: 'Missing ref.' } }),
    })
    await expect(client.fetchCompareBranches('fixture')).rejects.toMatchObject({
      code: 'ref_not_found',
      message: 'Missing ref.',
    })
    request.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: { code: 'unknown_error', message: 'Unknown.' } }),
    })
    await expect(client.fetchCompareBranches('fixture')).rejects.toMatchObject({
      code: 'invalid_response',
    })
  } finally {
    vi.unstubAllGlobals()
  }
})

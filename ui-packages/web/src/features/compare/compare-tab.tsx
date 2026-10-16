import type { CompareFile, CompareFileView } from '@herdr-roam/shared'
import { WorkerPoolContextProvider } from '@pierre/diffs/react'
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  PanelLeft,
  RefreshCw,
  WrapText,
} from 'lucide-react'
import { useContext, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import { ReadingFocusContext } from '../../components/reader/reading-focus'
import { Button } from '../../ui/button'
import { SearchField } from '../../ui/search-field'
import { SegmentedControl } from '../../ui/segmented-control'
import type { ResourceRef } from '../../workbench/resource'
import { BranchSelect } from './branch-select'
import { ChangedFileTree, changedTree } from './changed-tree'
import { type DiffBookmark, type DiffMode, DiffView } from './diff-view'
import { filePath } from './file-path'
import { readComparePreferences, writeComparePreference } from './preferences'
import styles from './style.module.scss'
import { useCompare } from './use-compare'

const poolOptions = {
  poolSize: 1,
  workerFactory: () => new Worker(new URL('./diff-worker.ts', import.meta.url), { type: 'module' }),
}
const highlighterOptions = { theme: { light: 'roam', dark: 'roam' } }
const modeOptions = [
  { value: 'split', label: 'Split' },
  { value: 'unified', label: 'Unified' },
] as const

const Stats = ({ files }: { readonly files: readonly CompareFile[] }) => (
  <span className={styles.stats}>
    <span className={styles.added}>+{files.reduce((sum, file) => sum + (file.added ?? 0), 0)}</span>
    <span className={styles.removed}>
      −{files.reduce((sum, file) => sum + (file.removed ?? 0), 0)}
    </span>
  </span>
)

const FileChangeDetails = ({
  entry,
  file,
}: {
  readonly entry: CompareFile
  readonly file: CompareFileView | null
}) => {
  const mode =
    entry.oldMode === null
      ? `New file mode ${entry.newMode}`
      : entry.newMode === null
        ? `Deleted file mode ${entry.oldMode}`
        : entry.oldMode !== entry.newMode
          ? `File mode ${entry.oldMode} → ${entry.newMode}`
          : null
  const oldHasBom = file?.kind === 'text' && (file.oldFile?.content.startsWith('\uFEFF') ?? false)
  const newHasBom = file?.kind === 'text' && (file.newFile?.content.startsWith('\uFEFF') ?? false)
  const bom = oldHasBom !== newHasBom ? `UTF-8 BOM ${newHasBom ? 'added' : 'removed'}` : null
  if (!mode && !bom) return null
  return (
    <div className={styles.changeDetails}>
      {mode && <span>{mode}</span>}
      {bom && <span>{bom}</span>}
    </div>
  )
}

export const CompareTab = ({
  resource,
  active,
}: {
  readonly resource: Extract<ResourceRef, { type: 'compare' }>
  readonly active: boolean
}) => {
  const compare = useCompare(resource.projectName, resource.workspaceId, active)
  const focus = useContext(ReadingFocusContext)
  const [query, setQuery] = useState('')
  const [treeVisible, setTreeVisible] = useState(true)
  const panelId = useId()
  const [preferences, setPreferences] = useState(readComparePreferences)
  const treeWidth = useRef(preferences.treeWidth ?? 250)
  const [narrow, setNarrow] = useState(false)
  const panel = useRef<HTMLDivElement>(null)
  const search = useRef<HTMLInputElement>(null)
  const [reading, setReading] = useState({
    snapshot: '',
    bookmarks: new Map<string, DiffBookmark>(),
  })
  const snapshot = compare.comparison
  const files = snapshot?.files ?? []
  const tree = useMemo(() => changedTree(snapshot?.files ?? [], query), [snapshot, query])
  const index = tree.paths.indexOf(compare.selectedPath)
  const mode: DiffMode = preferences.mode ?? (narrow ? 'unified' : 'split')
  const entry = files.find(file => filePath(file) === compare.selectedPath)
  const snapshotKey = snapshot ? `${snapshot.baseOid}:${snapshot.source.oid}` : ''
  if (snapshotKey && reading.snapshot !== snapshotKey) {
    setReading({ snapshot: snapshotKey, bookmarks: new Map() })
  }

  useEffect(() => {
    const node = panel.current
    if (!node || !active) return
    const measure = () => setNarrow(node.clientWidth < 720)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [active])

  useEffect(() => {
    if (!compare.selectedPath && tree.paths[0]) compare.selectFile(tree.paths[0])
  }, [compare.selectedPath, compare.selectFile, tree.paths])

  const navigate = (direction: number) => {
    const next =
      tree.paths[index < 0 ? (direction > 0 ? 0 : tree.paths.length - 1) : index + direction]
    if (next) compare.selectFile(next)
  }
  const chooseMode = (next: DiffMode) => {
    setPreferences(current => ({ ...current, mode: next }))
    writeComparePreference({ mode: next })
  }
  const toggleWrap = () => {
    setPreferences(current => ({ ...current, wrap: !current.wrap }))
    writeComparePreference({ wrap: !preferences.wrap })
  }
  const keyDown = (event: React.KeyboardEvent) => {
    if (!active) return
    const input =
      event.target instanceof HTMLElement &&
      (['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName) ||
        event.target.isContentEditable)
    if (event.altKey && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault()
      navigate(event.key === 'ArrowDown' ? 1 : -1)
    } else if (!input && event.key === '/') {
      event.preventDefault()
      setTreeVisible(true)
      requestAnimationFrame(() => search.current?.focus())
    }
  }
  const unavailable = {
    binary: 'Binary files cannot be previewed.',
    oversized: 'This file exceeds the 1 MiB text preview limit.',
    submodule: 'Submodule contents cannot be previewed.',
  } as const

  return (
    <WorkerPoolContextProvider poolOptions={poolOptions} highlighterOptions={highlighterOptions}>
      <section className={styles.compare} aria-label="Branch comparison" onKeyDown={keyDown}>
        <header className={styles.toolbar}>
          <div className={styles.branches}>
            <BranchSelect
              label="Source branch"
              value={compare.sourceRef}
              catalog={compare.catalog}
              onChange={compare.selectSource}
            />
            <span className={styles.direction}>
              <ArrowRight aria-label="compared into" />
            </span>
            <BranchSelect
              label="Target branch"
              value={compare.targetRef}
              catalog={compare.catalog}
              onChange={compare.selectTarget}
            />
          </div>
          <div className={styles.actions}>
            {snapshot && (
              <span className={styles.summary}>
                {files.length} files <Stats files={files} />
              </span>
            )}
            <Button
              size="compactIcon"
              title="Refresh local branches and commits"
              aria-label="Refresh comparison"
              onClick={compare.refresh}
              disabled={compare.loading}
            >
              <RefreshCw />
            </Button>
            {focus && (
              <Button
                size="compactIcon"
                title={focus.focused ? 'Exit focus mode' : 'Focus on comparison'}
                aria-label={focus.focused ? 'Exit focus mode' : 'Focus on comparison'}
                aria-pressed={focus.focused}
                onClick={focus.toggle}
              >
                {focus.focused ? <Minimize2 /> : <Maximize2 />}
              </Button>
            )}
          </div>
        </header>
        <Group
          className={styles.body}
          orientation="horizontal"
          resizeTargetMinimumSize={{ fine: 10, coarse: 24 }}
        >
          {treeVisible && (
            <Panel
              key="tree"
              id={`${panelId}-tree`}
              defaultSize={treeWidth.current}
              minSize={180}
              maxSize="60%"
              groupResizeBehavior="preserve-pixel-size"
              onResize={size => {
                if (size.inPixels < 180) return
                treeWidth.current = size.inPixels
                writeComparePreference({ treeWidth: size.inPixels })
              }}
            >
              <aside className={styles.changedFiles}>
                <div className={styles.filesHeading}>
                  <span>Changed files</span>
                  <span>{files.length}</span>
                </div>
                <div className={styles.search}>
                  <SearchField
                    ref={search}
                    label="Filter changed files"
                    size="sm"
                    placeholder="Filter files…"
                    value={query}
                    onChange={event => setQuery(event.target.value)}
                  />
                </div>
                <ChangedFileTree
                  nodes={tree.nodes}
                  query={query}
                  selectedPath={compare.selectedPath}
                  onSelect={compare.selectFile}
                />
                <div className={styles.treeFooter}>
                  {query ? `${tree.paths.length} matching files` : 'Committed changes only'}
                </div>
              </aside>
            </Panel>
          )}
          {treeVisible && (
            <Separator
              key="separator"
              aria-label="Resize changed files"
              className={styles.separator}
            />
          )}
          <Panel key="diff" id={`${panelId}-diff`} minSize={320}>
            <div className={styles.diffPanel} ref={panel}>
              <div className={styles.fileToolbar}>
                <Button
                  size="compactIcon"
                  aria-label={treeVisible ? 'Hide changed files' : 'Show changed files'}
                  title={treeVisible ? 'Hide changed files' : 'Show changed files'}
                  aria-pressed={treeVisible}
                  onClick={() => setTreeVisible(value => !value)}
                >
                  <PanelLeft />
                </Button>
                <span
                  className={styles.path}
                  title={
                    entry?.status === 'renamed'
                      ? `${entry.oldPath} → ${entry.newPath}`
                      : compare.selectedPath
                  }
                >
                  {compare.selectedPath || 'Branch comparison'}
                </span>
                {entry && <Stats files={[entry]} />}
                <span className={styles.filePosition}>
                  {index >= 0 ? `${index + 1} / ${tree.paths.length}` : '—'}
                </span>
                <Button
                  size="compactIcon"
                  aria-label="Previous changed file"
                  title="Previous file · Alt ↑"
                  disabled={tree.paths.length === 0 || index === 0}
                  onClick={() => navigate(-1)}
                >
                  <ChevronUp />
                </Button>
                <Button
                  size="compactIcon"
                  aria-label="Next changed file"
                  title="Next file · Alt ↓"
                  disabled={tree.paths.length === 0 || index === tree.paths.length - 1}
                  onClick={() => navigate(1)}
                >
                  <ChevronDown />
                </Button>
                <SegmentedControl
                  label="Diff layout"
                  size="sm"
                  options={modeOptions}
                  value={mode}
                  onValueChange={chooseMode}
                />
                <Button
                  size="compactIcon"
                  aria-label="Wrap long lines"
                  title="Wrap long lines"
                  aria-pressed={preferences.wrap}
                  onClick={toggleWrap}
                >
                  <WrapText />
                </Button>
              </div>
              {snapshot && (
                <div className={styles.revisions} data-mode={mode}>
                  <span>
                    Common base <code>{snapshot.baseOid.slice(0, 7)}</code>
                  </span>
                  <span title={snapshot.source.name}>
                    {snapshot.source.name} <code>{snapshot.source.oid.slice(0, 7)}</code>
                  </span>
                </div>
              )}
              {entry && <FileChangeDetails entry={entry} file={compare.file} />}
              {compare.error ? (
                <div className={styles.message} role="alert">
                  <strong>Comparison unavailable</strong>
                  <p>{compare.error}</p>
                  <Button size="compact" variant="secondary" onClick={compare.refresh}>
                    Try again
                  </Button>
                </div>
              ) : compare.loading ? (
                <div className={styles.message} role="status">
                  Loading comparison…
                </div>
              ) : !snapshot ? (
                <div className={styles.message}>
                  <strong>Choose branches to compare</strong>
                  <p>Select the source branch you want to merge and its target branch.</p>
                </div>
              ) : files.length === 0 ? (
                <div className={styles.message}>
                  <strong>No committed changes</strong>
                  <p>The source branch has no changes since the common base.</p>
                </div>
              ) : compare.fileError ? (
                <div className={styles.message} role="alert">
                  <p>{compare.fileError}</p>
                  <Button size="compact" variant="secondary" onClick={compare.retryFile}>
                    Try again
                  </Button>
                </div>
              ) : compare.fileLoading ? (
                <div className={styles.message} role="status">
                  Loading file…
                </div>
              ) : compare.file?.kind === 'unavailable' ? (
                <div className={styles.message}>
                  <strong>Preview unavailable</strong>
                  <p>{unavailable[compare.file.reason]}</p>
                </div>
              ) : compare.file?.kind === 'text' ? (
                <DiffView
                  key={`${reading.snapshot}:${compare.selectedPath}`}
                  file={compare.file}
                  mode={mode}
                  wrap={preferences.wrap}
                  bookmark={reading.bookmarks.get(compare.selectedPath)}
                  onBookmark={value => reading.bookmarks.set(compare.selectedPath, value)}
                />
              ) : (
                <div className={styles.message}>
                  {compare.selectedPath
                    ? 'Loading file…'
                    : 'Select a changed file to read its diff.'}
                </div>
              )}
              <footer className={styles.footer}>
                <span>
                  {snapshot ? 'Source changes since the common base' : 'Local Git branches'}
                </span>
                <span>Alt ↑ ↓ files · / filter</span>
              </footer>
            </div>
          </Panel>
        </Group>
      </section>
    </WorkerPoolContextProvider>
  )
}

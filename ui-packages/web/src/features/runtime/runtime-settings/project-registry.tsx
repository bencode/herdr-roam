import type {
  ObservedProjectDirectory,
  Project,
  ProjectCreateRequest,
} from '@herdr-roam/shared'
import { Check, FolderPlus, Plus, X } from 'lucide-react'
import { useState } from 'react'

type Draft = {
  readonly source: 'candidate' | 'manual'
  readonly path: string
  readonly name: string
}

const inputClass =
  'h-8 w-full rounded-sm border border-border bg-background px-2 font-mono text-xs outline-none placeholder:text-faint focus:border-primary'

const AddForm = ({
  draft,
  submitting,
  error,
  onChange,
  onCancel,
  onSubmit,
}: {
  readonly draft: Draft
  readonly submitting: boolean
  readonly error: string | null
  readonly onChange: (draft: Draft) => void
  readonly onCancel: () => void
  readonly onSubmit: () => void
}) => (
  <form
    className="grid gap-3 border-border border-b bg-background/55 px-3 py-3"
    onSubmit={event => {
      event.preventDefault()
      onSubmit()
    }}
  >
    <label className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-3 text-xs text-muted">
      Absolute path
      <input
        className={inputClass}
        readOnly={draft.source === 'candidate'}
        value={draft.path}
        onChange={event => onChange({ ...draft, path: event.target.value })}
        placeholder="/Users/name/work/project"
        aria-label="Project absolute path"
      />
    </label>
    <label className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-3 text-xs text-muted">
      Project name
      <input
        className={inputClass}
        value={draft.name}
        onChange={event => onChange({ ...draft, name: event.target.value })}
        placeholder="project-name"
        aria-label="Project name"
      />
    </label>
    <div className="flex min-h-7 items-center gap-2 pl-[7.25rem] text-xs">
      {error ? (
        <span className="min-w-0 flex-1 text-danger" role="alert">
          {error}
        </span>
      ) : (
        <span className="min-w-0 flex-1 truncate text-faint">
          URL: /projects/{draft.name || 'project-name'}
        </span>
      )}
      <button
        type="button"
        className="flex h-7 items-center gap-1 rounded-sm border-0 bg-transparent px-2 text-muted hover:bg-hover hover:text-foreground [&_svg]:size-3"
        onClick={onCancel}
      >
        <X aria-hidden="true" /> Cancel
      </button>
      <button
        type="submit"
        className="flex h-7 items-center gap-1 rounded-sm border-0 bg-primary px-2.5 text-white hover:opacity-90 [&_svg]:size-3"
        disabled={submitting || draft.path.trim() === '' || draft.name.trim() === ''}
      >
        <Check aria-hidden="true" /> {submitting ? 'Adding…' : 'Add project'}
      </button>
    </div>
  </form>
)

export const ProjectRegistry = ({
  projects,
  observedDirectories,
  configPath,
  loadError,
  onAdd,
}: {
  readonly projects: readonly Project[]
  readonly observedDirectories: readonly ObservedProjectDirectory[]
  readonly configPath: string | null
  readonly loadError: string | null
  readonly onAdd: (request: ProjectCreateRequest) => Promise<void>
}) => {
  const [draft, setDraft] = useState<Draft | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const registeredPaths = new Set(projects.map(project => project.path))
  const candidates = observedDirectories.filter(directory => !registeredPaths.has(directory.path))

  const begin = (next: Draft) => {
    setDraft(next)
    setError(null)
  }

  const submit = async () => {
    if (!draft || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await onAdd({ name: draft.name.trim(), path: draft.path.trim() })
      setDraft(null)
    } catch (submissionError) {
      console.error('Project registration failed', submissionError)
      setError(
        submissionError instanceof Error ? submissionError.message : 'Project could not be added.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="mt-10" aria-labelledby="runtime-projects-heading">
      <div className="flex items-end gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="m-0 text-sm font-semibold" id="runtime-projects-heading">
            Projects
          </h2>
          <p className="mt-1 mb-0 text-xs text-muted">
            Registered directories can start Codex or Claude from the Workbench.
          </p>
        </div>
        <button
          type="button"
          className="flex h-8 items-center gap-1.5 rounded-md border border-border bg-transparent px-2.5 text-xs hover:bg-hover [&_svg]:size-3.5"
          disabled={Boolean(loadError)}
          onClick={() => begin({ source: 'manual', path: '', name: '' })}
        >
          <FolderPlus aria-hidden="true" /> Add directory
        </button>
      </div>

      {configPath && (
        <p className="mt-3 mb-0 truncate font-mono text-[0.6875rem] text-faint" title={configPath}>
          {configPath}
        </p>
      )}
      {loadError && (
        <p className="mt-3 rounded-md border border-danger/30 bg-danger/8 p-3 text-xs text-danger" role="alert">
          {loadError}
        </p>
      )}

      <div className="mt-4 border-border border-t">
        {projects.map(project => (
          <div
            className="flex min-h-12 items-center gap-3 border-border border-b px-3"
            key={project.name}
          >
            <span className="min-w-0 flex-1">
              <strong className="block truncate text-xs font-medium">{project.name}</strong>
              <small className="block truncate font-mono text-[0.6875rem] text-faint">
                {project.path}
              </small>
            </span>
            <span className="text-[0.6875rem] text-success">Registered</span>
          </div>
        ))}
        {projects.length === 0 && !loadError && (
          <div className="border-border border-b px-3 py-4 text-xs text-muted">
            No Projects registered yet. Add an observed directory or enter an absolute path.
          </div>
        )}
      </div>

      {draft?.source === 'manual' && (
        <AddForm
          draft={draft}
          submitting={submitting}
          error={error}
          onChange={setDraft}
          onCancel={() => setDraft(null)}
          onSubmit={() => void submit()}
        />
      )}

      {candidates.length > 0 && (
        <div className="mt-6">
          <h3 className="mt-0 mb-2 text-xs font-medium text-muted">Observed in Herdr</h3>
          <div className="border-border border-t">
            {candidates.map(candidate => (
              <div key={candidate.path}>
                <div className="flex min-h-12 items-center gap-3 border-border border-b px-3">
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-xs font-medium">
                      {candidate.suggestedName}
                    </strong>
                    <small className="block truncate font-mono text-[0.6875rem] text-faint">
                      {candidate.path}
                    </small>
                  </span>
                  <span className="text-[0.6875rem] text-faint">
                    {candidate.agentCount > 0 ? `${candidate.agentCount} agents · ` : ''}
                    {candidate.paneCount} panes
                  </span>
                  <button
                    type="button"
                    className="flex h-7 items-center gap-1 rounded-sm border-0 bg-transparent px-2 text-primary hover:bg-primary-soft [&_svg]:size-3"
                    disabled={Boolean(loadError)}
                    onClick={() =>
                      begin({
                        source: 'candidate',
                        path: candidate.path,
                        name: candidate.suggestedName,
                      })
                    }
                  >
                    <Plus aria-hidden="true" /> Add
                  </button>
                </div>
                {draft?.source === 'candidate' && draft.path === candidate.path && (
                  <AddForm
                    draft={draft}
                    submitting={submitting}
                    error={error}
                    onChange={setDraft}
                    onCancel={() => setDraft(null)}
                    onSubmit={() => void submit()}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

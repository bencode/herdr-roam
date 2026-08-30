import type { Project } from '@herdr-roam/shared'
import { ArrowLeft, Check, Trash2 } from 'lucide-react'
import { useState } from 'react'

const actionClass =
  'flex h-7 items-center justify-center gap-1.5 rounded-sm border-0 px-2.5 text-xs disabled:opacity-45 [&_svg]:size-3'

export const AddProjectForm = ({
  onBack,
  onAdd,
}: {
  readonly onBack: () => void
  readonly onAdd: (path: string) => Promise<void>
}) => {
  const [path, setPath] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!path.trim() || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await onAdd(path.trim())
    } catch (submissionError) {
      console.error('Project add failed', submissionError)
      setError(
        submissionError instanceof Error ? submissionError.message : 'Project could not be added.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      className="p-2"
      onSubmit={event => {
        event.preventDefault()
        void submit()
      }}
    >
      <button
        type="button"
        className="mb-2 flex h-7 items-center gap-1 rounded-sm px-1.5 text-xs text-muted hover:bg-hover hover:text-foreground [&_svg]:size-3"
        onClick={onBack}
      >
        <ArrowLeft aria-hidden="true" /> Projects
      </button>
      <label className="block text-xs text-muted">
        Absolute path
        <input
          className="mt-1.5 h-8 w-full rounded-sm border border-border bg-background px-2 font-mono text-xs outline-none placeholder:text-faint focus:border-primary"
          value={path}
          onChange={event => {
            setPath(event.target.value)
            setError(null)
          }}
          placeholder="/Users/name/work/project"
        />
      </label>
      {error && (
        <p className="mt-2 mb-0 text-xs text-danger" role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        className={`${actionClass} mt-3 ml-auto bg-primary text-white hover:opacity-90`}
        disabled={!path.trim() || submitting}
      >
        <Check aria-hidden="true" /> {submitting ? 'Adding…' : 'Add project'}
      </button>
    </form>
  )
}

export const ManageProjects = ({
  projects,
  onBack,
  onRemove,
}: {
  readonly projects: readonly Project[]
  readonly onBack: () => void
  readonly onRemove: (projectName: string) => Promise<void>
}) => {
  const [confirming, setConfirming] = useState<string | null>(null)
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const remove = async (projectName: string) => {
    if (removing) return
    setRemoving(true)
    setError(null)
    try {
      await onRemove(projectName)
      setConfirming(null)
    } catch (removalError) {
      console.error('Project removal failed', removalError)
      setError(
        removalError instanceof Error ? removalError.message : 'Project could not be removed.',
      )
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className="p-2">
      <button
        type="button"
        className="mb-1 flex h-7 items-center gap-1 rounded-sm px-1.5 text-xs text-muted hover:bg-hover hover:text-foreground [&_svg]:size-3"
        onClick={onBack}
      >
        <ArrowLeft aria-hidden="true" /> Projects
      </button>
      <div className="max-h-64 overflow-auto">
        {projects.map(project => (
          <div className="border-border border-b px-1 py-2 last:border-b-0" key={project.name}>
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1">
                <strong className="block truncate text-xs font-medium">{project.name}</strong>
                <small className="block truncate font-mono text-[0.625rem] text-faint">
                  {project.path}
                </small>
              </span>
              {confirming !== project.name && (
                <button
                  type="button"
                  className="grid size-7 flex-none place-items-center rounded-sm text-muted hover:bg-danger/10 hover:text-danger [&_svg]:size-3"
                  aria-label={`Remove ${project.name}`}
                  onClick={() => {
                    setConfirming(project.name)
                    setError(null)
                  }}
                >
                  <Trash2 aria-hidden="true" />
                </button>
              )}
            </div>
            {confirming === project.name && (
              <div className="mt-2 flex items-center gap-2 text-xs">
                <span className="min-w-0 flex-1 text-muted">Remove from Roam?</span>
                <button
                  type="button"
                  className={`${actionClass} bg-transparent text-muted hover:bg-hover`}
                  onClick={() => setConfirming(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={`${actionClass} bg-danger text-white hover:opacity-90`}
                  disabled={removing}
                  onClick={() => void remove(project.name)}
                >
                  {removing ? 'Removing…' : 'Remove'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      {error && (
        <p className="mt-2 mb-0 text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

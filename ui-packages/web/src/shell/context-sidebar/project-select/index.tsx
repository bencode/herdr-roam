import type { Project } from '@herdr-roam/shared'
import * as Popover from '@radix-ui/react-popover'
import { Check, ChevronDown, FolderPlus, Settings2 } from 'lucide-react'
import { useState } from 'react'
import { AddProjectForm, ManageProjects } from './project-actions'

type Mode = 'list' | 'add' | 'manage'

type Props = {
  readonly projects: readonly Project[]
  readonly value: string
  readonly error: string | null
  readonly configPath: string | null
  readonly onValueChange: (projectName: string) => void
  readonly onAdd: (path: string) => Promise<Project>
  readonly onRemove: (projectName: string) => Promise<void>
}

export const ProjectSelect = ({
  projects,
  value,
  error,
  configPath,
  onValueChange,
  onAdd,
  onRemove,
}: Props) => {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>('list')
  const active = projects.find(project => project.name === value)

  const close = () => {
    setOpen(false)
    setMode('list')
  }

  return (
    <Popover.Root
      open={open}
      onOpenChange={next => {
        setOpen(next)
        if (!next) setMode('list')
      }}
    >
      <Popover.Trigger asChild>
        <button
          type="button"
          className="flex h-7.5 min-w-0 flex-1 items-center justify-between gap-2 rounded-sm border-0 bg-transparent px-2 text-left font-semibold transition-colors duration-150 hover:bg-hover data-[state=open]:bg-hover"
          aria-label="Active project"
        >
          <span className="truncate">{active?.name ?? 'Add project'}</span>
          <ChevronDown className="w-3.5 flex-none text-muted" aria-hidden="true" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="z-[var(--z-dropdown)] w-[var(--radix-popover-trigger-width)] min-w-64 rounded-md border border-border bg-surface text-foreground shadow-[var(--shadow-popover)] outline-none"
          align="start"
          sideOffset={4}
          onOpenAutoFocus={event => {
            if (mode === 'list') event.preventDefault()
          }}
        >
          {mode === 'add' && (
            <AddProjectForm
              onBack={() => setMode('list')}
              onAdd={async path => {
                const project = await onAdd(path)
                onValueChange(project.name)
                close()
              }}
            />
          )}
          {mode === 'manage' && (
            <ManageProjects
              projects={projects}
              onBack={() => setMode('list')}
              onRemove={onRemove}
            />
          )}
          {mode === 'list' && (
            <div className="p-1">
              {projects.map(project => (
                <button
                  type="button"
                  className="flex min-h-8 w-full items-center gap-2 rounded-sm px-2 text-left text-xs hover:bg-hover"
                  key={project.name}
                  onClick={() => {
                    onValueChange(project.name)
                    close()
                  }}
                >
                  <span className="min-w-0 flex-1 truncate">{project.name}</span>
                  {project.name === value && (
                    <Check className="size-3 flex-none text-primary" aria-hidden="true" />
                  )}
                </button>
              ))}
              {error && (
                <div
                  className="m-1 rounded-sm bg-danger/8 px-2 py-2 text-xs text-danger"
                  role="alert"
                >
                  <p className="m-0">{error}</p>
                  {configPath && (
                    <p className="mt-1 mb-0 truncate font-mono text-[0.625rem]">{configPath}</p>
                  )}
                </div>
              )}
              <div className="mt-1 border-border border-t pt-1">
                <button
                  type="button"
                  className="flex h-8 w-full items-center gap-2 rounded-sm px-2 text-left text-xs hover:bg-hover [&_svg]:size-3.5"
                  disabled={Boolean(error)}
                  onClick={() => setMode('add')}
                >
                  <FolderPlus aria-hidden="true" /> Add project…
                </button>
                {projects.length > 0 && (
                  <button
                    type="button"
                    className="flex h-8 w-full items-center gap-2 rounded-sm px-2 text-left text-xs text-muted hover:bg-hover hover:text-foreground [&_svg]:size-3.5"
                    disabled={Boolean(error)}
                    onClick={() => setMode('manage')}
                  >
                    <Settings2 aria-hidden="true" /> Manage projects…
                  </button>
                )}
              </div>
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

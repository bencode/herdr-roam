import type { ReactNode } from 'react'
import { cn } from '../../../../lib/cn'
import type { ProjectSection } from '../../../../workbench/resource'

export const projectSections: readonly ProjectSection[] = ['sessions', 'files']

const labels: Readonly<Record<ProjectSection, string>> = {
  sessions: 'Sessions',
  files: 'Files',
}

type Props = {
  readonly value: ProjectSection
  readonly onValueChange: (section: ProjectSection) => void
  readonly trailing?: ReactNode
}

export const ProjectViewTabs = ({ value, onValueChange, trailing }: Props) => (
  <div className="flex h-8 flex-none items-stretch gap-2 border-border border-b px-2">
    <nav className="grid flex-none grid-cols-[repeat(2,auto)]" aria-label="Project resources">
      {projectSections.map(section => {
        const active = value === section
        return (
          <button
            type="button"
            key={section}
            className={cn(
              'relative min-w-0 rounded-t-sm border-0 bg-transparent px-2.5 text-center text-xs text-muted transition-colors duration-150 hover:bg-hover hover:text-foreground',
              active &&
                "font-semibold text-foreground after:absolute after:right-1.5 after:bottom-[-1px] after:left-1.5 after:h-0.5 after:bg-primary after:content-['']",
            )}
            data-active={active || undefined}
            aria-pressed={active}
            onClick={() => onValueChange(section)}
          >
            {labels[section]}
          </button>
        )
      })}
    </nav>
    {trailing && <div className="ml-auto flex min-w-0 items-center">{trailing}</div>}
  </div>
)

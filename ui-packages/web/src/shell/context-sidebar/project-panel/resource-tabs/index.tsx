import { cn } from '../../../../lib/cn'
import type { ProjectSection } from '../resource-list'

export const projectSections: readonly ProjectSection[] = ['sessions', 'issues', 'loops', 'files']

const labels: Readonly<Record<ProjectSection, string>> = {
  sessions: 'Sessions',
  issues: 'Issues',
  loops: 'Loops',
  files: 'Files',
}

type Props = {
  readonly value: ProjectSection
  readonly onValueChange: (section: ProjectSection) => void
}

export const ProjectViewTabs = ({ value, onValueChange }: Props) => (
  <nav
    className="grid h-7.5 grid-cols-4 border-border border-b px-2"
    aria-label="Project resources"
  >
    {projectSections.map(section => {
      const active = value === section
      return (
        <button
          type="button"
          key={section}
          className={cn(
            'relative min-w-0 rounded-t-sm border-0 bg-transparent px-1 text-center text-[0.6875rem] text-muted transition-colors duration-150 hover:bg-hover hover:text-foreground',
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
)

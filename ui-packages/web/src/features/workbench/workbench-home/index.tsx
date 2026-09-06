import type { Project } from '@herdr-roam/shared'
import type { ResourceRef } from '../../../workbench/resource'
import { AgentLauncher } from './agent-launcher'

export const WorkbenchHome = ({
  project,
  onOpen,
  visible = true,
}: {
  readonly project: Project
  readonly onOpen: (resource: ResourceRef) => void
  readonly visible?: boolean
}) => {
  return (
    <div className="h-full overflow-auto bg-surface px-[clamp(1.5rem,4vw,2.5rem)] py-10">
      <div className="mx-auto w-full max-w-3xl">
        <p className="mt-0 mb-2 font-mono text-primary text-xs">{project.path}</p>
        <h1 className="m-0 text-balance font-[650] text-2xl tracking-[-0.025em]">New Session</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted leading-6">
          Open a native coding agent in {project.name}, then start the conversation.
        </p>
        <AgentLauncher project={project} onOpen={onOpen} visible={visible} />
      </div>
    </div>
  )
}

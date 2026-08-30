import type { Project } from '@herdr-roam/shared'
import { CircleDot, Play, Radio } from 'lucide-react'
import { cn } from '../../../lib/cn'
import type { SessionStatus } from '../../../mock/data'
import { sessions } from '../../../mock/data'
import type { ResourceRef } from '../../../workbench/resource'
import { useAgentRuntime } from '../../agent/runtime-provider'
import { AgentLauncher } from './agent-launcher'

const statusClasses: Readonly<Record<SessionStatus, string>> = {
  working: 'bg-primary',
  blocked: 'bg-warning',
  idle: 'bg-primary',
  done: 'bg-success',
}

export const WorkbenchHome = ({
  project,
  onOpen,
}: {
  readonly project: Project
  readonly onOpen: (resource: ResourceRef) => void
}) => {
  const projectName = project.name
  const projectSessions = sessions.filter(session => session.projectName === projectName)
  const { snapshot } = useAgentRuntime()
  return (
    <div className="h-full overflow-auto bg-surface px-[clamp(1.5rem,4vw,2.5rem)] py-10">
      <div className="mx-auto w-full max-w-3xl">
        <p className="mt-0 mb-2 font-mono text-primary text-xs">{project.path}</p>
        <h1 className="m-0 text-balance font-[650] text-2xl tracking-[-0.025em]">
          Start work in {project.name}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted leading-6">
          Start a native Agent in this directory, then continue from its live Inspector.
        </p>
        <AgentLauncher project={project} onOpen={onOpen} />

        <div className="mt-10 grid gap-8 min-[64rem]:grid-cols-2">
          <section>
            <h2 className="mt-0 mb-3 flex items-center gap-2 font-[650] text-sm">
              <Radio className="w-4 text-primary" /> Recent Sessions
            </h2>
            <div className="border-border border-t">
              {projectSessions.map(session => (
                <button
                  type="button"
                  key={session.id}
                  className="flex h-11 w-full items-center gap-3 border-0 border-border border-b bg-transparent px-1 text-left hover:bg-hover"
                  onClick={() => onOpen({ type: 'session', projectName, sessionId: session.id })}
                >
                  <i
                    className={cn('size-1.5 flex-none rounded-full', statusClasses[session.status])}
                  />
                  <span className="min-w-0 flex-1 truncate">{session.title}</span>
                  <span className="text-faint text-xs">{session.updated}</span>
                </button>
              ))}
            </div>
          </section>
          <section>
            <h2 className="mt-0 mb-3 flex items-center gap-2 font-[650] text-sm">
              <CircleDot className="w-4 text-primary" /> Global runtime
            </h2>
            <dl className="m-0 grid grid-cols-[6.875rem_1fr] gap-y-3 border-border border-t py-4 text-sm [&_dd]:m-0 [&_dt]:text-muted">
              <dt>Agents</dt>
              <dd>{snapshot.items.length} globally visible</dd>
              <dt>Working</dt>
              <dd>{snapshot.items.filter(agent => agent.status === 'working').length}</dd>
              <dt>Runtime</dt>
              <dd className="flex items-center gap-2">
                <Play className="w-3 text-success" /> {snapshot.source.state}
              </dd>
            </dl>
          </section>
        </div>
      </div>
    </div>
  )
}

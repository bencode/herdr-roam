import { ArrowUp, CircleDot, Play, Radio } from 'lucide-react'
import { useState } from 'react'
import { cn } from '../../../lib/cn'
import type { AgentStatus } from '../../../mock/data'
import { agents, projectByName, sessions } from '../../../mock/data'
import type { ResourceRef } from '../../../workbench/resource'

const statusClasses: Readonly<Record<AgentStatus, string>> = {
  working: 'bg-primary',
  blocked: 'bg-warning',
  idle: 'bg-primary',
  done: 'bg-success',
}

export const WorkbenchHome = ({
  projectName,
  onOpen,
}: {
  readonly projectName: string
  readonly onOpen: (resource: ResourceRef) => void
}) => {
  const project = projectByName(projectName)
  const projectSessions = sessions.filter(session => session.projectName === projectName)
  const projectAgents = agents.filter(agent => agent.projectName === projectName)
  const [prompt, setPrompt] = useState('')

  const startMockSession = () => {
    const session = projectSessions[0]
    if (!session || prompt.trim() === '') return
    onOpen({ type: 'session', projectName, sessionId: session.id })
    setPrompt('')
  }

  return (
    <div className="h-full overflow-auto bg-surface px-[clamp(1.5rem,4vw,2.5rem)] py-10">
      <div className="mx-auto w-full max-w-3xl">
        <p className="mt-0 mb-2 font-mono text-primary text-xs">{project?.path ?? projectName}</p>
        <h1 className="m-0 text-balance font-[650] text-2xl tracking-[-0.025em]">
          Start work in {project?.name ?? projectName}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted leading-6">
          This layout milestone uses local fixtures. Starting work opens a representative Session;
          Herdr is not connected yet.
        </p>

        <form
          className="mt-8 rounded-lg border border-border bg-background p-3"
          onSubmit={event => {
            event.preventDefault()
            startMockSession()
          }}
        >
          <textarea
            className="block min-h-20 w-full resize-none border-0 bg-transparent p-1 text-sm outline-0 placeholder:text-faint"
            value={prompt}
            onChange={event => setPrompt(event.target.value)}
            placeholder="Describe the work…"
            aria-label="Describe the work"
          />
          <div className="mt-2 flex items-center gap-3 text-faint text-xs">
            <span>Codex</span>
            <span>{project?.path}</span>
            <button
              type="submit"
              className="ml-auto grid size-8 place-items-center rounded-md border-0 bg-primary text-white"
              disabled={prompt.trim() === ''}
              aria-label="Start mock Session"
            >
              <ArrowUp className="size-4" />
            </button>
          </div>
        </form>

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
              <CircleDot className="w-4 text-primary" /> Runtime snapshot
            </h2>
            <dl className="m-0 grid grid-cols-[6.875rem_1fr] gap-y-3 border-border border-t py-4 text-sm [&_dd]:m-0 [&_dt]:text-muted">
              <dt>Agents</dt>
              <dd>{projectAgents.length} visible</dd>
              <dt>Working</dt>
              <dd>{projectAgents.filter(agent => agent.status === 'working').length}</dd>
              <dt>Runtime</dt>
              <dd className="flex items-center gap-2">
                <Play className="w-3 text-success" /> Mock data
              </dd>
            </dl>
          </section>
        </div>
      </div>
    </div>
  )
}

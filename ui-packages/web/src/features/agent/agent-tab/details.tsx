import type { AgentSummary } from '@herdr-roam/shared'
import { Check, Copy, X } from 'lucide-react'
import { agentProviderLabel } from '../presentation'

type Props = {
  readonly agent: AgentSummary
  readonly id: string
  readonly copiedDirectory: boolean
  readonly onCopyDirectory: () => void
  readonly onClose: () => void
}

export const AgentDetails = ({ agent, id, copiedDirectory, onCopyDirectory, onClose }: Props) => (
  <aside className="w-64 flex-none border-border border-l bg-sidebar/40" id={id}>
    <header className="flex h-11 items-center border-border border-b px-4">
      <h2 className="m-0 text-sm font-medium">Agent details</h2>
      <button
        type="button"
        aria-label="Close Agent details"
        className="ml-auto grid size-7 place-items-center rounded-md border-0 bg-transparent text-muted hover:bg-hover hover:text-foreground [&_svg]:size-3.5"
        onClick={onClose}
      >
        <X aria-hidden="true" />
      </button>
    </header>
    <dl className="m-0 grid gap-5 px-4 py-5 text-xs [&_dd]:m-0 [&_dd]:mt-1 [&_dd]:break-words [&_dt]:text-faint">
      <div>
        <dt>Status</dt>
        <dd className="capitalize">{agent.status}</dd>
      </div>
      <div>
        <dt>Provider</dt>
        <dd>{agentProviderLabel(agent.provider) ?? 'Unknown'}</dd>
      </div>
      <div>
        <dt>Working directory</dt>
        <dd className="flex items-start gap-1.5">
          <span className="min-w-0 flex-1 break-all font-mono text-[0.6875rem] leading-4">
            {agent.cwd ?? 'Unavailable'}
          </span>
          {agent.cwd && (
            <button
              type="button"
              className="grid size-6 flex-none place-items-center rounded-sm border-0 bg-transparent text-muted hover:bg-hover hover:text-foreground [&_svg]:size-3.5"
              aria-label={copiedDirectory ? 'Working directory copied' : 'Copy working directory'}
              title={copiedDirectory ? 'Working directory copied' : 'Copy working directory'}
              onClick={onCopyDirectory}
            >
              {copiedDirectory ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            </button>
          )}
        </dd>
      </div>
      <div>
        <dt>Attach target</dt>
        <dd className="font-mono text-[0.6875rem]">{agent.attachTarget}</dd>
      </div>
    </dl>
  </aside>
)

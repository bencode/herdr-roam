import type { AgentSummary } from '@herdr-roam/shared'
import * as Popover from '@radix-ui/react-popover'
import { Check, Copy, Info, X } from 'lucide-react'
import { Button } from '../../../ui/button'
import { PopoverContent } from '../../../ui/popover'
import { agentProviderLabel } from '../presentation'

type Props = {
  readonly agent: AgentSummary
  readonly copiedDirectory: boolean
  readonly onCopyDirectory: () => void
}

export const AgentDetails = ({ agent, copiedDirectory, onCopyDirectory }: Props) => (
  <Popover.Root>
    <Popover.Trigger asChild>
      <Button
        size="compactIcon"
        className="flex-none"
        aria-label="Show Agent details"
        title="Agent details"
      >
        <Info aria-hidden="true" />
      </Button>
    </Popover.Trigger>
    <PopoverContent className="w-72" align="end">
      <header className="flex h-8 items-center border-border border-b pr-1.5 pl-3">
        <h2 className="m-0 text-xs font-semibold">Agent details</h2>
        <Popover.Close asChild>
          <Button aria-label="Close Agent details" className="ml-auto" size="compactIcon">
            <X aria-hidden="true" />
          </Button>
        </Popover.Close>
      </header>
      <dl className="m-0 grid gap-3 px-3 py-3 text-xs [&_dd]:m-0 [&_dd]:mt-0.5 [&_dd]:break-words [&_dt]:text-faint">
        <div>
          <dt>Name</dt>
          <dd>{agent.name}</dd>
        </div>
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
            <span className="min-w-0 flex-1 break-all font-mono text-2xs leading-4">
              {agent.cwd ?? 'Unavailable'}
            </span>
            {agent.cwd && (
              <Button
                className="flex-none"
                size="compactIcon"
                aria-label={copiedDirectory ? 'Working directory copied' : 'Copy working directory'}
                title={copiedDirectory ? 'Working directory copied' : 'Copy working directory'}
                onClick={onCopyDirectory}
              >
                {copiedDirectory ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
              </Button>
            )}
          </dd>
        </div>
        <div>
          <dt>Attach target</dt>
          <dd className="font-mono text-2xs">{agent.attachTarget}</dd>
        </div>
      </dl>
    </PopoverContent>
  </Popover.Root>
)

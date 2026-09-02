import type { AgentRuntimeSnapshot } from '@herdr-roam/shared'
import * as Popover from '@radix-ui/react-popover'
import { Check, Copy, ExternalLink } from 'lucide-react'
import { useState } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../../ui/button'

const INSTALL_COMMAND = 'curl -fsSL https://herdr.dev/install.sh | sh'
const START_COMMAND = 'herdr server'
const INSTALL_URL = 'https://herdr.dev/docs/install/'

const commandFor = (snapshot: AgentRuntimeSnapshot): string | null => {
  if (snapshot.source.state === 'connected') return null
  if (snapshot.source.code === 'herdr_missing') return INSTALL_COMMAND
  if (snapshot.source.code === 'herdr_not_running') return START_COMMAND
  return null
}

export const RuntimeStatus = ({
  snapshot,
  transportError,
}: {
  readonly snapshot: AgentRuntimeSnapshot
  readonly transportError: string | null
}) => {
  const [copied, setCopied] = useState(false)
  const connected = snapshot.source.state === 'connected'
  const reconnecting = snapshot.source.state === 'reconnecting' || snapshot.stale
  const command = commandFor(snapshot)
  const blocked = snapshot.items.filter(agent => agent.status === 'blocked').length
  const label = connected ? 'connected' : reconnecting ? 'reconnecting' : 'offline'

  const copyCommand = async () => {
    if (!command) return
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
      setTimeout(() => setCopied(false), 1_500)
    } catch (error) {
      console.error('Runtime command copy failed', error)
    }
  }

  return (
    <Popover.Root onOpenChange={open => !open && setCopied(false)}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="flex h-full min-w-0 flex-1 items-center gap-2 rounded-sm px-1.5 text-left text-[0.6875rem] text-muted hover:bg-hover hover:text-foreground"
          aria-label={`Runtime status: ${label}`}
        >
          <i
            className={cn(
              'size-1.5 flex-none rounded-full',
              connected ? 'bg-success' : reconnecting ? 'bg-warning' : 'bg-danger',
            )}
            aria-hidden="true"
          />
          {connected ? (
            <>
              <span>{snapshot.items.length} agents</span>
              <span className="text-warning">{blocked} blocked</span>
            </>
          ) : (
            <span>{reconnecting ? 'Herdr reconnecting' : 'Herdr offline'}</span>
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="z-[var(--z-dropdown)] w-80 rounded-md border border-border bg-surface p-3 text-foreground shadow-[var(--shadow-popover)] outline-none"
          align="start"
          side="top"
          sideOffset={6}
        >
          <h2 className="m-0 text-sm font-semibold">Herdr Runtime</h2>
          {connected ? (
            <dl className="mt-3 mb-0 grid grid-cols-[5rem_1fr] gap-y-2 text-xs [&_dd]:m-0 [&_dt]:text-muted">
              <dt>Status</dt>
              <dd className="text-success">Connected</dd>
              <dt>Version</dt>
              <dd>{snapshot.source.version}</dd>
              <dt>Protocol</dt>
              <dd>{snapshot.source.protocol}</dd>
              <dt>Agents</dt>
              <dd>{snapshot.items.length}</dd>
            </dl>
          ) : (
            <>
              <p className="mt-2 mb-0 text-xs leading-5 text-muted">{snapshot.source.message}</p>
              {transportError && (
                <p className="mt-1.5 mb-0 text-xs leading-5 text-faint">{transportError}</p>
              )}
              {command && (
                <div className="mt-3 flex items-center gap-2 rounded-sm bg-background px-2.5 py-2">
                  <code className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[0.6875rem]">
                    {command}
                  </code>
                  <Button
                    className="flex-none"
                    size="compact"
                    onClick={() => void copyCommand()}
                  >
                    {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              )}
              {snapshot.source.code === 'herdr_not_running' && (
                <p className="mt-2 mb-0 text-xs leading-5 text-muted">
                  Run this in Terminal. Roam connects automatically after Herdr starts.
                </p>
              )}
              {(snapshot.source.code === 'herdr_missing' ||
                snapshot.source.code === 'protocol_incompatible') && (
                <a
                  className="mt-3 inline-flex h-7 items-center gap-1 text-xs text-primary no-underline hover:underline [&_svg]:size-3"
                  href={INSTALL_URL}
                  target="_blank"
                  rel="noreferrer"
                >
                  Installation guide <ExternalLink aria-hidden="true" />
                </a>
              )}
            </>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

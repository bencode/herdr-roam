import type { AgentStatus } from '@herdr-roam/shared'
import * as Popover from '@radix-ui/react-popover'
import { Square } from 'lucide-react'
import { Button } from '../../../ui/button'

export const AgentStopControl = ({
  status,
  stopping,
  historyAvailable,
  disabled = false,
  onStop,
}: {
  readonly status: AgentStatus
  readonly stopping: boolean
  readonly historyAvailable: boolean
  readonly disabled?: boolean
  readonly onStop: () => void
}) => {
  const interruptsWork = status === 'working' || status === 'blocked'

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button disabled={disabled || stopping}>
          <Square aria-hidden="true" />
          {stopping ? 'Stopping…' : 'Stop'}
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="z-[var(--z-dropdown)] w-72 rounded-md border border-border bg-surface p-3 text-foreground shadow-[var(--shadow-popover)] outline-none"
          align="end"
          sideOffset={5}
        >
          <h2 className="m-0 text-sm font-semibold">Stop this Agent?</h2>
          <p className="mt-1.5 mb-0 text-xs leading-5 text-muted">
            The live Herdr pane and its Agent process will close.
            {historyAvailable && ' Session history stays available.'}
          </p>
          {interruptsWork && (
            <p className="mt-1.5 mb-0 text-xs leading-5 text-warning">
              Current work or pending input will be interrupted.
            </p>
          )}
          <div className="mt-3 flex justify-end gap-1.5">
            <Popover.Close asChild>
              <Button size="compact">Cancel</Button>
            </Popover.Close>
            <Popover.Close asChild>
              <Button
                aria-label="Confirm stop"
                size="compact"
                variant="danger"
                onClick={onStop}
              >
                Stop
              </Button>
            </Popover.Close>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

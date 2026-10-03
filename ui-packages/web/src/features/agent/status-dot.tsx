import type { AgentStatus } from '@herdr-roam/shared'
import { cn } from '../../lib/cn'
import { agentStatusClasses } from './presentation'

/** `label={null}` marks the dot as decorative when adjacent text already names the status. */
export const StatusDot = ({
  status,
  label = status ?? 'stopped',
  className,
}: {
  readonly status: AgentStatus | null
  readonly label?: string | null
  readonly className?: string
}) => (
  <i
    className={cn(
      'size-1.5 flex-none rounded-full',
      status ? agentStatusClasses[status] : 'bg-faint',
      className,
    )}
    {...(label === null ? { 'aria-hidden': true } : { role: 'img', 'aria-label': label })}
  />
)

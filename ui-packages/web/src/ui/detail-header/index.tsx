import type { ReactNode } from 'react'

type DetailHeaderProps = {
  readonly icon: ReactNode
  readonly title: string
  readonly detail?: string
  readonly meta?: ReactNode
  readonly actions?: ReactNode
}

export const DetailHeader = ({ icon, title, detail, meta, actions }: DetailHeaderProps) => (
  <header className="flex h-10 flex-none items-center gap-2 border-border border-b px-4">
    <span className="flex flex-none items-center text-primary [&>svg]:size-3.5">{icon}</span>
    <h1 className="m-0 min-w-0 max-w-[45%] flex-none truncate text-xs font-semibold" title={title}>
      {title}
    </h1>
    <span className="min-w-0 flex-1 truncate font-mono text-2xs text-faint" title={detail}>
      {detail}
    </span>
    {meta && <div className="flex flex-none items-center gap-1.5 text-2xs text-faint">{meta}</div>}
    {actions && <div className="flex flex-none items-center gap-1">{actions}</div>}
  </header>
)

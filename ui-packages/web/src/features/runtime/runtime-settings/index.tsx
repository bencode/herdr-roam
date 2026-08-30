import { Server } from 'lucide-react'
import { useAgentRuntime } from '../../agent/runtime-provider'

export const RuntimeSettings = () => {
  const { snapshot, transportError } = useAgentRuntime()
  const rows = [
    ['Herdr', snapshot.source.state],
    ['Version', snapshot.source.state === 'connected' ? snapshot.source.version : 'Unavailable'],
    [
      'Protocol',
      snapshot.source.state === 'connected' ? String(snapshot.source.protocol) : 'Unavailable',
    ],
    [
      'Agents',
      snapshot.stale ? `${snapshot.items.length} cached in memory` : String(snapshot.items.length),
    ],
  ] as const

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="h-10 flex-none border-border border-b px-4 py-2.75 text-[0.8125rem]">
        Settings / Runtime
      </header>
      <main className="mx-auto min-h-0 w-[min(42rem,calc(100%-3rem))] flex-1 overflow-auto py-10">
        <h1 className="m-0 flex items-center gap-2.5 text-2xl">
          <Server className="w-4.5 text-primary" aria-hidden="true" /> Runtime
        </h1>
        <p className="mt-2 mb-8 text-[0.8125rem] text-muted">
          Connection to the default local Herdr server.
        </p>
        <dl className="mt-0 mb-4 border-border border-t">
          {rows.map(([label, value]) => (
            <div
              className="grid min-h-11 grid-cols-[11rem_1fr] items-center border-border border-b text-xs"
              key={label}
            >
              <dt className="text-muted">{label}</dt>
              <dd className="m-0 flex items-center gap-1.5">
                {label === 'Herdr' && (
                  <i className="size-1.75 rounded-full bg-primary" aria-hidden="true" />
                )}
                {value}
              </dd>
            </div>
          ))}
        </dl>
        {snapshot.source.state !== 'connected' && (
          <p className="mt-4 rounded-md border border-warning/30 bg-warning/8 p-3 text-xs text-muted">
            {snapshot.source.message}
          </p>
        )}
        {transportError && <small className="text-danger">{transportError.message}</small>}
      </main>
    </div>
  )
}

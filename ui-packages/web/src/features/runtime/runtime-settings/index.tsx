import { Server } from 'lucide-react'

const rows = [
  ['Herdr', 'Connected'],
  ['Server ownership', 'Roam-managed'],
  ['Codex', 'Ready'],
  ['Claude', 'Ready'],
] as const

export const RuntimeSettings = () => (
  <div className="flex min-h-0 flex-1 flex-col">
    <header className="h-10 flex-none border-border border-b px-4 py-2.75 text-[0.8125rem]">
      Settings / Runtime
    </header>
    <main className="mx-auto w-[min(42rem,calc(100%-3rem))] py-10">
      <h1 className="m-0 flex items-center gap-2.5 text-2xl">
        <Server className="w-4.5 text-primary" aria-hidden="true" /> Runtime
      </h1>
      <p className="mt-2 mb-8 text-[0.8125rem] text-muted">
        Local Herdr connection and provider readiness.
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
                <i className="size-1.75 rounded-full bg-success" aria-hidden="true" />
              )}
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <small className="text-muted">
        Runtime values are local fixtures in this layout milestone.
      </small>
    </main>
  </div>
)

# Herdr Agent Runtime

## Status

Implemented as the first real runtime slice. It supports inspection and bounded
Prompt submission but does not establish Project or Session ownership.

## Boundary

Herdr is the only source of live Agent state. The Roam server discovers the
default local server with `herdr status server --json`, connects to its Unix
socket, and translates protocol 20 responses into browser-facing contracts.
It does not start or stop Herdr in this slice.

The server keeps only the latest Agent snapshot in memory. A disconnect after
a successful read retains that snapshot as stale until reconnection; a process
restart or browser reload cannot recover it from disk. Agent output is read on
demand and is never persisted.

## API

```text
GET /api/agents
GET /api/agents/events
GET /api/agents/:agentId/output
POST /api/agents/:agentId/prompts
```

`/api/agents` returns the complete current snapshot, including Herdr connection
state. `/api/agents/events` sends the same complete shape over SSE after every
relevant global Herdr pane event. Herdr's status-change subscription requires a
specific pane target, so Roam also refreshes the authoritative list every two
seconds. The browser replaces its in-memory snapshot rather than reproducing
Herdr's state machine.

The Prompt endpoint accepts non-blank text, resolves the Agent's current
`pane_id`, and calls Herdr `agent.prompt` without waiting for the resulting
turn. Only `idle` and `done` Agents accept Prompts. A working, blocked, unknown,
stale, missing, or disconnected Agent returns an explicit error rather than
queuing input or acquiring terminal control.

`terminal_id` is the public Agent ID. `pane_id` remains the runtime target used
for output reads and the copied `herdr agent attach <target>` command. CWD is
diagnostic metadata only and is not used to infer a Project.

Only the HTTP and SSE payload types live in `@herdr-roam/shared`. Runtime Zod
validation stays at the Web API boundary, Herdr wire Schemas remain in the
server package, and transport errors and React state stay inside the Web Agent
feature.

## Browser behavior

The Agents activity groups the raw Herdr statuses `blocked`, `working`, `idle`,
`done`, and `unknown`. An Agent opens at `/agents/:agentId` in the shared Tab
workbench. The Inspector polls recent unwrapped ANSI output only while its
React Activity is visible and retains the last successful text in component
memory when a later read fails. The output is requested as ANSI and rendered on
a fixed dark terminal surface. The renderer interprets SGR styles, drops other
escape and control sequences, preserves long lines with horizontal scrolling,
and does not reconstruct message boundaries from terminal output. The Composer
preserves a draft while its Tab is mounted, sends with Enter, inserts a newline
with Shift+Enter, and clears the draft only after the server accepts the Prompt.
It does not persist drafts.

Starting agents, interrupting processes, Browser Attach, Project mapping, and
historical Session discovery are deferred.

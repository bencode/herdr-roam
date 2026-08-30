# Herdr Agent Runtime

## Status

Implemented as a live Agent runtime. It supports Project-scoped Agent creation,
inspection, Prompt submission, and native Herdr focus without inventing Session
or conversation ownership.

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
POST /api/agents
GET /api/agents/events
GET /api/agents/:agentId/output
POST /api/agents/:agentId/prompts
POST /api/agents/:agentId/focus
```

`/api/agents` returns the complete current snapshot, including Herdr connection
state. `/api/agents/events` sends the same complete shape over SSE after every
relevant global Herdr pane event. Herdr's status-change subscription requires a
specific pane target, so Roam also refreshes the authoritative list every two
seconds. The browser replaces its in-memory snapshot rather than reproducing
Herdr's state machine.

The Agent creation endpoint accepts a registered Project Name, `codex` or
`claude`, and a non-blank initial Prompt. The server resolves the trusted
Project path, creates one Herdr Workspace rooted there, starts the Agent in its
root Pane, waits for the expected named Agent to become interactive, submits the
Prompt, and returns its stable terminal ID. Agent names are deterministic and
receive a numeric suffix on conflict. A failure after Workspace creation keeps
that Workspace and returns its Pane, Terminal, and attach command for recovery.

The Prompt endpoint accepts non-blank text, resolves the Agent's current
`pane_id`, and calls Herdr `agent.prompt` without waiting for a turn. `working`,
`idle`, and `done` Agents accept Prompts; `blocked` and `unknown` Agents require
native interaction or a reliable status. Roam does not interpret `agent.wait`
as a conversation-turn boundary.

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

Interrupting processes, ending Workspaces, Browser Attach, and historical
Session discovery are deferred.

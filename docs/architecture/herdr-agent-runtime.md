# Herdr Agent Runtime

## Status

Implemented as a live Agent runtime. It supports Project-scoped Agent creation
and native browser Terminal interaction without inventing Session or conversation
ownership. Existing HTTP output, Prompt, input, and focus APIs remain compatible.

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
POST /api/agents/:agentId/input
POST /api/agents/:agentId/focus
```

`/api/agents` returns the complete current snapshot, including Herdr connection
state. `/api/agents/events` sends the same complete shape over SSE after every
relevant global Herdr pane event. Herdr's status-change subscription requires a
specific pane target, so Roam also refreshes the authoritative list every two
seconds. The browser replaces its in-memory snapshot rather than reproducing
Herdr's state machine.

The Agent creation endpoint accepts a registered `projectName`, `provider`
(`codex` or `claude`), optional `workspaceId`, and optional `prompt`.
`workspaceId` defaults to `primary`. The server resolves it through the Project's
current workspace catalog and creates one Herdr Workspace at the resolved path.
Arbitrary browser-provided paths are not accepted. A missing or inaccessible
selected directory returns HTTP 409 (`project_directory_unavailable`), never a
fallback to the Project root. Workspace discovery failure returns HTTP 503
(`agent_launch_unavailable`).

Startup waits for the named Agent to become interactive and returns its stable
terminal ID, independently of native Session discovery. Omitting `prompt` opens
an empty Agent without sending any text or keys. Existing callers may still
supply a non-blank initial Prompt, subject to the existing UTF-8 limit. Agent
names are deterministic and receive a numeric suffix on conflict. A failure
after Workspace creation keeps that Workspace and returns its Pane, Terminal,
and attach command for recovery.

The retained Prompt endpoint accepts non-blank text or up to four local PNG, JPEG, or
WebP images. Text-only Prompts call Herdr `agent.prompt`. Image Prompts are
written to private files in the host operating system's temporary directory;
their paths are pasted into the native Agent composer before text and Enter are
sent. These files are not Project artifacts or configuration and are left to
the operating system's temporary-file lifecycle. `working`, `idle`, and `done`
Agents accept Prompts; `blocked` and `unknown` Agents require native interaction
or a reliable status. Roam does not interpret `agent.wait` as a
conversation-turn boundary.

The input endpoint accepts validated logical key names or non-empty text. While
an Agent is `blocked`, keys are forwarded through Herdr `agent.send_keys` and
text through `pane.send_input`; Roam does not interpret the native TUI state.
Outside `blocked`, only one `Shift+Tab` chord is accepted so the Prompt composer
can toggle a provider-owned mode without Roam tracking Plan/Default state.
Initial Prompts, follow-up Prompt text, and HTTP direct input are limited to
64 KiB of UTF-8 at the HTTP boundary. The Agent page no longer uses the HTTP
output, Prompt, or input APIs; its native input travels over WebSocket.

`terminal_id` is the public Agent ID. `pane_id` remains the runtime target used
for output reads and the copied `herdr agent attach <target>` command. CWD is
diagnostic metadata only and is not used to infer a Project.

HTTP, SSE, and browser terminal wire types live in `@herdr-roam/shared`. Runtime Zod
validation stays at the Web API boundary, Herdr wire Schemas remain in the
server package, and transport errors and React state stay inside the Web Agent
feature.

## Browser behavior

New Session lives on the existing Workbench, without a duplicate Sessions toolbar
action. It submits a directory ID and Provider without a Prompt. The browser
adds the returned Agent to its runtime snapshot before navigating to the Agent
page, unless it is already present in a newer snapshot. Connection state
is unchanged; subsequent SSE snapshots still replace the full list. This avoids
an unavailable page while the next periodic runtime snapshot is pending.

The Agent page resolves a native Session reference against registered
Projects' workspace catalogs, using the most specific matching directory and
preferring a primary directory on ties. Directory lookup is triggered by changes
to Project inputs, cwd, or the Session reference, not every runtime status update.
Lookup failures are visible and retryable without disabling Agent input. A
resolved reference adds Open Session without changing the active resource.

The Agents activity groups the raw Herdr statuses `blocked`, `working`, `idle`,
`done`, and `unknown`. An Agent opens at `/agents/:agentId` in the shared Tab
workbench. Session pages read durable native history and offer Resume or Open
Agent; they do not embed runtime input or Terminal.

An active Agent Tab mounts a lazy-loaded BrowserTerminal directly. There is no
Preview mode, recent-output polling, custom ANSI preview parser, or independent
Prompt composer. Details open on demand. Open Session, Copy attach, and Stop
Agent… remain in the Agent header. BrowserTerminal portals its connection status
and recovery controls into a header slot without lifting connection ownership.
There is no Disconnect action or separate toolbar; explanatory text above the
screen appears only for recovery states.

Each mount attempts one control connection once the runtime is available, with
takeover disabled. Runtime snapshot refreshes and ordinary rerenders do not
reconnect. Switching away unmounts Terminal and releases its connection;
returning mounts a new Terminal and attempts a new connection. Connection failure,
takeover, or runtime loss after the first attempt requires explicit Reconnect
during the current visit. Native permissions are never approved
automatically; blocked Agents use the same native Terminal interaction.

Local image paths, including spaces and non-ASCII text, use the normal terminal
input transport. The native Agent handles path recognition and file reading.
The Web UI does not upload clipboard images or stage attachments, and a path must
be accessible on the Agent's host.

Stopping an Agent closes its Herdr Pane after explicit confirmation; native
Session history remains available from the provider files. Browser Terminal release does not call Stop or close the Agent Pane.

Agent working directories also feed the independent Project Registry discovery
bridge. Only the nearest Git root of an Agent cwd may be persisted as a Project;
Pane directories are not queried or exposed in the Agent HTTP snapshot. Project
discovery failures never replace an invalid Project configuration or disconnect
the live Agent runtime.

## Browser terminal transport

`GET /api/agents/:agentId/terminal?mode=control|observe&cols=N&rows=N&takeover=false`
upgrades a same-origin local WebSocket. The server validates the Agent against
the runtime snapshot before spawning `herdr terminal session control / observe`
with its terminal ID, argument arrays and no shell. The existing focus HTTP API
remains available for compatibility, but has no toolbar action.

The shared terminal contract defines ANSI frames, input, resize, scroll, release,
acknowledgements and errors. CLI stdout is bounded NDJSON; ANSI frames are screen
deltas, not PTY logs. A new connection starts with a full frame and consumes
sequential frames. xterm acknowledges only after its write callback; the server
waits before reading another frame. Unacknowledged frames time out after 30s.
Wire input is bounded to 64 KiB, output to 4 MiB, and dimensions to 1–1000 cells.
The browser caps each paste at 32 KiB before base64 encoding.

Only control connections forward input, resize and native scroll. Observe rejects
all mutations server-side and mirrors the current screen without resizing the
owner. xterm scrollback is disabled because Herdr owns screen history. OSC 52
clipboard writes are explicitly ignored. Terminal data is not logged.

Busy ownership offers Observe or explicit Take over. Closing the WebSocket,
leaving the view or server shutdown releases the CLI helper, never the Agent.
Returning to the Agent Tab attempts a new connection without takeover. Within
the same visit, disconnect or failure requires explicit Reconnect; no input is
replayed. Herdr CLI failures remain visible, and Session history remains available
independently of Terminal.

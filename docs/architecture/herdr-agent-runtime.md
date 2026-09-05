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

The Prompt endpoint accepts non-blank text or up to four local PNG, JPEG, or
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
Initial Prompts, follow-up Prompt text, and direct terminal text are limited to
64 KiB of UTF-8 at both the browser and HTTP boundary.

`terminal_id` is the public Agent ID. `pane_id` remains the runtime target used
for output reads and the copied `herdr agent attach <target>` command. CWD is
diagnostic metadata only and is not used to infer a Project.

Only the HTTP and SSE payload types live in `@herdr-roam/shared`. Runtime Zod
validation stays at the Web API boundary, Herdr wire Schemas remain in the
server package, and transport errors and React state stay inside the Web Agent
feature.

## Browser behavior

New Session lives on the existing Workbench, without a duplicate Sessions toolbar
action. It submits a directory ID and Provider without a Prompt. The browser
adds the returned Agent to its runtime snapshot before navigating to the Agent
Inspector, unless it is already present in a newer snapshot. Connection state
is unchanged; subsequent SSE snapshots still replace the full list. This avoids
an unavailable page while the next periodic runtime snapshot is pending.

The Agent Inspector resolves a native Session reference against registered
Projects' workspace catalogs, using the most specific matching directory and
preferring a primary directory on ties. Directory lookup is triggered by changes
to Project inputs, cwd, or the Session reference, not every runtime status update.
Lookup failures are visible and retryable without disabling Agent input. A
resolved reference adds Open Session without changing the active resource.

The Agents activity groups the raw Herdr statuses `blocked`, `working`, `idle`,
`done`, and `unknown`. An Agent opens at `/agents/:agentId` in the shared Tab
workbench. Agent tabs and the Live mode of a resumed Session use the same runtime
surface: recent output, blocked input, and the Prompt composer have one behavior
and implementation while their routes and surrounding headers remain distinct.

The runtime surface polls recent unwrapped ANSI output only while its React
Activity is visible and retains the last successful text in component memory
when a later read fails. Each read asks Herdr for 500 recent lines. The server
then returns at most the newest 512 KiB on a UTF-8 boundary and sets `truncated`
when older bytes were removed; the browser replaces the prior snapshot and
discloses the bounded tail without caching or accumulating it. Output is
rendered on a fixed dark terminal surface. The renderer interprets SGR styles,
drops other escape and control sequences, preserves long lines with horizontal
scrolling, and does not reconstruct message boundaries from terminal output.
The Composer preserves a draft while its Activity is mounted, sends with Enter,
inserts a newline with Shift+Enter, and forwards Shift+Tab while focused. Pasted
images appear as removable local previews and are uploaded only when the Prompt
is submitted. The Composer clears text and previews only after the server
accepts the Prompt. It does not persist drafts or attachments.

When an Agent is `blocked`, the visible Composer is removed and the terminal
surface becomes a keyboard-focusable input target. Enter or an unselected
pointer click focuses a visually hidden textarea that captures native navigation
keys, Enter, Escape, Tab, Shift+Tab, text input, IME commits, and paste. Escape
is queued before focus returns to the safe terminal surface; Shift+Tab remains
provider-owned and does not move browser focus. Input writes are serialized in
browser order, independently of output reads. Successful writes request an
immediate refresh, with concurrent refresh requests coalesced into at most one
trailing read. Entering `blocked` never steals focus, and selecting terminal
text does not activate input.

Stopping an Agent closes its Herdr Pane after explicit confirmation; native
Session history remains available from the provider files. Browser Attach and
process-level interrupt controls beyond the forwarded native input remain
deferred.

Agent working directories also feed the independent Project Registry discovery
bridge. Only the nearest Git root of an Agent cwd may be persisted as a Project;
Pane directories are not queried or exposed in the Agent HTTP snapshot. Project
discovery failures never replace an invalid Project configuration or disconnect
the live Agent runtime.

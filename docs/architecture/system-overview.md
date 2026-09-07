# System Overview

## Architecture Goal

Herdr Roam adds a local personal AI software studio above one Herdr server. It
consumes runtime state rather than owning agent processes, and it exposes local
project resources without becoming a general-purpose file server or Web IDE.

```text
Browser
   │
   │ HTTP, Server-Sent Events, and explicit terminal attach transport
   ▼
Herdr Roam Server
   ├── Herdr Unix socket
   ├── Codex and Claude session metadata
   ├── project files and Git metadata
   └── user-level and project-level skills
```

The browser cannot connect directly to a local Unix socket. The Herdr Roam
server is therefore both the browser API and the adapter for local runtime and
filesystem data.

## Runtime Boundaries

### Herdr

Herdr remains responsible for PTYs, processes, persistence, agent detection,
runtime status, and attachment. Herdr Roam must not duplicate these
responsibilities or infer a second source of truth when Herdr already supplies
one.

### Herdr Roam server

The server:

- discovers and connects to the default local Herdr server;
- connects to the default Herdr server and reports when it is absent;
- translates Herdr runtime concepts into project, agent, and conversation views;
- reads bounded project, session, and skill resources;
- creates the Herdr runtime location required to start an agent from the Web;
- provides read APIs and a small set of explicit control operations;
- streams state changes to the browser;
- proxies Herdr terminal session control/observe while an Agent resource Tab is active;
- serves only local clients by default.

### Browser application

The browser presents Project, Agent, Session, File, and Skill views
inside one tabbed work area. It does not access the filesystem or Herdr socket
directly. Session pages render provider-owned conversation history, while Agent
pages expose the native Terminal for output and input, without a separate composer.

## Herdr Discovery

The server discovers Herdr through the installed CLI rather than hard-coding a
socket path. It uses Herdr's session metadata to select the entry marked as the
default and then connects to that local socket.

If the binary is missing, Roam reports an explicit prerequisite error with
diagnostics and Retry. It does not provide an installer, execute package-manager
commands, or teach Herdr setup.

The current runtime slice connects to a running default server and reconnects
when that connection is lost. It does not start or stop Herdr. Runtime ownership
and managed startup remain later control capabilities. The first version
supports one local server and does not expose remote connection profiles.

Roam can create a Herdr Workspace rooted at the selected directory, use its root
Pane, start a supported native agent, and submit the initial Prompt. These
runtime objects remain hidden from regular users. Codex or Claude must already
be installed and authenticated; Roam reports missing or unauthenticated provider
CLIs instead of attempting to own their credentials.

Existing built-in Herdr integrations may provide richer state or Session
identity. Their installation and configuration remain outside the basic Roam
startup flow.

## Communication Model

Browser reads and ordinary control actions use HTTP. Live agent status and
activity use Server-Sent Events; terminal screen updates use WebSocket.

SSE carries runtime snapshots independently of Terminal connections. Opening an
Agent Tab automatically attempts one bidirectional connection for terminal
bytes, resize events, and input. Leaving or closing that resource Tab tears down
the stream without stopping the Herdr Agent. Returning opens a new connection;
unexpected disconnection and connection failures require Reconnect during the current
visit. Each connection starts with a full screen before incremental updates resume.

Herdr allows one direct attach controller. Roam exposes read-only observation
and explicit takeover when another client controls the terminal; it never
takes over silently. Copying an attach command does not launch an external
terminal process.

Public API routes and payload shapes are defined with the feature that first
uses them. The shared package owns only resulting browser/server wire contracts;
Herdr transport types and browser state remain beside their consumers. Runtime
validation is applied at external boundaries.

## Repository Structure

```text
herdr-roam/
├── packages/
│   └── shared/             # Browser/server wire contracts
├── web-packages/
│   └── server/             # Hono API, Herdr adapter, and bounded file access
├── ui-packages/
│   └── web/                # React single-page application
├── docs/
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

The first version does not add a database core package or a separate worker.
Herdr is already the process runtime, and the filesystem and agent providers
already contain the source data Herdr Roam reads.

## Technology Choices

- **Workspace and language:** pnpm workspace and TypeScript.
- **Web application:** React, Vite, React Router, and Tailwind CSS.
- **Accessible UI primitives:** Radix UI.
- **Server:** Hono on Node.js.
- **Boundary validation:** Zod.
- **Live updates:** Server-Sent Events.
- **Browser Terminal:** an on-demand terminal renderer over a bidirectional
  transport.
- **Quality tooling:** Biome and Vitest.

Zustand may hold small cross-feature interface preferences such as selection,
filters, and panel state. Server-derived runtime data must not be copied into an
unbounded global client store without a clear invalidation model.

Markdown and source-code viewers belong to the Web application. The terminal
renderer is code-split from Session and artifact readers and loads when an Agent
page is opened. Exact rendering libraries should be selected
with their implementing feature rather than preinstalled speculatively.

Project file access is stateless and paged. Git supplies tracked and unignored
paths when available; non-Git Projects use a bounded filesystem fallback. The
shared Markdown core stays light, while math, Mermaid, syntax highlighting, and
file-type readers load only when the selected content requires them. The exact
catalog, size, raw-asset, and containment rules are defined in
[Project Files](project-files.md).

Skill access is likewise stateless and read-only. The server scans the direct
children of personal and active-project `.agents/skills`, `.codex/skills`, and
`.claude/skills` roots. It parses bounded `SKILL.md` frontmatter and reads
supporting directories in cursor pages. A top-level Skill directory symlink is
accepted as the trusted Skill root, while paths and nested symlinks may not
escape that canonical root. Missing source directories are empty sources;
malformed, broken, and unreadable Skills are returned as catalog warnings.

## Data Sources and Derived Views

Herdr runtime state is authoritative for live agents. Codex and Claude session
metadata is authoritative for historical conversations. The local filesystem is
authoritative for project files, artifacts, and existing user-level and
project-level Skills.

A small local Project Registry maps a unique, stable Project Name to each
trusted project root. Its ordered array is the source for the Project Selector;
it is not a project or task database. The contract and URL behavior are defined
in [Project Registry and Routing](project-registry-and-routing.md).

Task trackers are external to Herdr Roam. Agents may use GitHub Issues or another
tracker through that system's native tools, but Roam does not mirror tracker
records into project files, browser state, or a second API.

Herdr Roam derives global and per-project views from those sources. It does not
persist a duplicate task, agent, artifact, or conversation model in a database
in the first version.

Session discovery reads Codex JSONL files under `~/.codex/sessions` and Claude
JSONL files under `~/.claude/projects` on demand. A Session belongs to a Project
only when its recorded working directory is that registered Project root or a
descendant. Roam stores neither a Session index nor copied messages; provider
files remain the durable source, including after the corresponding Agent has
stopped. Session detail routes include both provider and provider Session ID so
identical IDs cannot collide across adapters.

Session catalogs remain stateless. Each request reads only the bounded identity
record needed to scope and order native files; titles are read for the requested
page, with server-side cursor pagination and debounced title filtering. Session
history uses opaque byte cursors over the selected native file. The initial view
reads the latest bounded page, older pages read preceding ranges, and live views
read only bytes appended after the last complete record. No cursor or derived
metadata is persisted between requests.

Herdr's `agent_session` metadata links a running Agent back to its provider
Session. Resuming an offline Session validates its recorded directory against
the registered Project, starts the provider with its native resume arguments,
and then returns the resulting Herdr Agent. If Herdr already reports an Agent
for that provider Session ID, Roam reuses it instead of starting another one.

Runtime terms are translated at the server boundary:

- working directories and Git roots become projects;
- supported managed processes become agents;
- provider session identifiers become conversation references;
- panes remain attachment and diagnostic details;
- readable project outputs become artifact candidates without moving or copying
  the underlying files.

## Filesystem Security

The server must never accept an arbitrary absolute path from the browser.
Project and skill access is limited to roots discovered from trusted local
runtime and session context.

Every requested path is resolved and checked against its allowed root before it
is read. Symbolic links and parent-directory traversal must not escape that
root. Unsupported, inaccessible, or oversized files return explicit errors
rather than guessed or empty content.

Project, artifact, Session, and Skill readers are read-only. The server exposes
no general project-file mutation API.

## Local Security and Persistence

The server binds to `127.0.0.1` by default. Because the first version is local
and single-user, it has no account or authentication system and must not be
presented as safe for public network exposure.

No application database is required. The Project Registry and global Runtime
setting remain in local application configuration; small interface preferences
may remain in browser storage. The
browser may persist the ordered set of open resource references, but not copied
resource content; the active resource remains a deep-linkable URL. Project
files remain in their original repositories. Connection, read, and
runtime-start errors are observable in the interface and server
logs; unknown errors must not be replaced with empty fallback data.

## Herdr References

- [Agents and direct attach](https://herdr.dev/docs/agents/)
- [Socket API](https://herdr.dev/docs/socket-api/)

# Workbench Interactions

## Status

This document records the implemented desktop interaction model for Herdr Roam.
It is a product wireframe, not a visual design system.

The target is a 1440px desktop browser with compact but calm information density.
Labels, spacing, and component placement may evolve, but the hierarchy and
interaction boundaries in this document are intentional.

## Interaction Principles

- Keep one primary work surface. Secondary context appears in the sidebar or in
  a temporary inspector, not in permanent dashboard columns.
- Keep the active project visible. Project work always starts in an explicit
  directory.
- Prefer readable text, Markdown, code, and diffs over terminal output.
- Show live terminal state only where it is operationally useful.
- Preserve native Codex, Claude, and Herdr behavior instead of recreating their
  execution models.
- Make status precise. `working`, `idle`, `blocked`, `done`, and `unknown` are
  distinct Herdr states.

## Information Structure

```text
Herdr Roam
├── Projects
│   └── Active Project
│       ├── Workbench
│       ├── Sessions
│       ├── Issues
│       └── Files
├── Agents                 cross-project live runtime
└── Skills                 user skills and active-project skills
```

Projects, Agents, and Skills are global dimensions. Sessions, Issues, and Files
live inside the active project. Theme is a direct utility control,
not another resource dimension or route-backed destination.

These resources remain orthogonal. A Session can use a Skill to read or write
Issues, but one resource does not own the others.

## Application Shell

The default shell has two panes: a left navigation area and one tabbed work
area. The left area combines a fixed Activity Bar with a contextual panel. The
three global dimensions switch that panel without clearing open resources from
the work area.

```text
┌────────────────────────────┬──────────────────────────────────────────────────────────┐
│ ROAM                       │ herdr-roam / Workbench                                  │
├────┬───────────────────────┼──────────────────────────────────────────────────────────┤
│ P  │ herdr-roam         ▾  │                                                          │
│    │ Workbench             │                                                          │
│ A  │                       │                                                          │
│    │ Sessions          14 ▾│                    Main work surface                     │
│ S  │ Search sessions...    │                                                          │
│    │ ● Product scan    now │                                                          │
│    │ ● API review      12m │                                                          │
│    │                       │                                                          │
│    │                       │                                                          │
│ ⚙  │ 4 agents · 1 blocked  │                                                          │
└────┴───────────────────────┴──────────────────────────────────────────────────────────┘
```

The Activity Bar contains Projects, Agents, and Skills at the top, with a Theme
control at the bottom. Each global Activity is a route-backed
navigation link with an inset selected surface, an accessible label, and
`aria-current`. The project panel begins with one compact row for Issues,
Sessions, and Files, followed by the selected resource browser. Switching
that row changes only the sidebar browser; it does not navigate, replace the
active Workbench tab, or clear resource-local state. A concrete list item opens
or reuses its resource tab and updates the canonical route. Collection routes
remain valid deep links and select their matching browser on direct entry,
reload, and browser history navigation.

Switching to Agents or Skills does not clear the active project. Each Activity
remembers its last canonical path in browser storage; returning to Projects can
therefore restore the exact Session, Issue, File, or Project collection that was
previously active. React Activity keeps each contextual panel mounted during the
page lifetime, preserving its local resource-browser selection, search, and
scroll position as well. A full reload derives the browser selection from the
canonical route and does not restore an uncommitted sidebar-only switch, search,
or scroll state. Theme opens a small direct selector without changing the route,
Activity navigation memory, or active project. A compact
`PanelLeft` control in the project header collapses the sidebar to the Activity
Bar and restores its previous width. While collapsed, the ROAM mark remains
visible and changes into the expand control on hover or keyboard focus. Selecting
a global Activity also expands the sidebar, and the collapsed state survives
reload.

### Workbench tabs

Workbench is a fixed project home. Session, Issue, File, and Skill resources
open to its right using one shared tab foundation. Opening an existing resource
activates its tab instead of creating a duplicate. Tabs can span projects and
show project context when names collide; activating a cross-project tab does
not silently change the active project.

Closing a tab closes only the view. It does not stop an Agent, close an Issue,
or modify a file. Closing the active tab selects its right neighbor, then its
left neighbor, then Workbench. A resource tab context menu can close that tab,
the other tabs, the tabs to its right, or all resource tabs. Bulk close updates
the ordered tab set once; if it removes the active tab, the same neighbor rule
selects the next route. Workbench remains fixed and is never part of a bulk
close. Inactive tabs retain local view state such as a Session draft or Markdown
Preview/Source mode. Overflow scrolls horizontally; tabs are never hidden,
evicted, or capped by count to fit the viewport.

Files uses a lazy directory tree rather than a preloaded Project snapshot.
Expanding a folder requests one page of its current children; search returns a
flat server-side path result. The Files toolbar and each open File tab provide
explicit refresh controls. Selecting the already-open file activates its tab,
and the active file is highlighted in the tree when its ancestors are open.

A Git Project groups its existing worktree directories under one Project. When
more than one directory exists, Issues and Files place the same compact
directory selector beside search and share its last selection. The collapsed
control leads with the directory name and shows the
branch as metadata; the menu adds the full path for disambiguation. Arrow keys,
Home, End, Enter, and Escape work without introducing a separate management
screen. Selecting a directory clears the current browser search and Files
expansion state but does not navigate. Only opening a concrete resource updates
the route. Existing File and Issue tabs remain bound to the Workspace in which
they were opened, while activating one selects its Workspace in the sidebar.

The File tab keeps identity and path in a compact header, then gives the rest of
the workbench to a content-specific reader. Markdown provides Preview/Source,
an outline when space permits, relative file navigation, and local images.
HTML provides a sandboxed Preview/Source choice. Source code scrolls without
wrapping; images use a neutral inspection canvas. Binary and oversized content
explain why preview is unavailable instead of showing an empty surface.

The active resource is represented by a deep-linkable URL. The ordered tab set
is an interface preference stored in the browser and contains resource
references only, not copied Session, Issue, File, or Skill content.
Canonical Project routes and restoration behavior are defined in
[Project Registry and Routing](../architecture/project-registry-and-routing.md).

The Project selector presents one flat list of remembered Projects. Herdr Agent
working directories are automatically resolved to Git roots and remembered;
the selector also contains Add Project and Manage Projects modes for explicit
paths and removal. The UI does not expose registered, observed, or candidate
states. With no Projects, `/projects` remains open and teaches the user to add
one from the selector.

## Runtime Detection and Ownership

Herdr and at least one authenticated agent CLI are product prerequisites. Roam
does not install or teach them. A regular user still does not need to learn
Herdr workspaces, tabs, panes, or server commands to use the Web application.

### Herdr is missing

```text
┌──────────────────────────┬────────────────────────────────────────────────────────────┐
│ ROAM                     │ Herdr is unavailable                                      │
│                          │                                                            │
│ Runtime error            │ Roam could not find `herdr` on PATH or connect to its      │
│                          │ default local server.                                      │
│                          │                                                            │
│                          │ Check the runtime outside Roam, then retry.                 │
│                          │                                                            │
│                          │                                            [Retry]         │
└──────────────────────────┴────────────────────────────────────────────────────────────┘
```

Roam checks for Codex and Claude CLIs and reports which providers are ready,
missing, or require login. These states are diagnostics, not installation or
authentication flows.

```text
Runtime check

Herdr       ready · server running
Codex       ready
Claude      login required

At least one agent is ready.                              [Continue]
```

Built-in Herdr integrations may improve state or Session identity. Managing
those integrations is an advanced runtime concern and does not block basic
startup.

Runtime availability remains contextual: the sidebar summary reports aggregate
availability, while the Agent list and Terminal page explain connection failures or
stale data where those conditions block an action. A dedicated Runtime page,
diagnostics workflow, and server-ownership preference are deferred until the
next product-design phase defines the problem they solve.

## Project Workbench

The Workbench is the default page for the active project. Its New Session form
opens a native Agent without requiring an initial Prompt. Select the Workbench
tab to access this form; the Sessions toolbar has no duplicate creation action.

```text
Workbench / New Session

Working directory  [ main · Project root ▾ ]
                   /work/herdr-roam
Provider           [ Codex ▾ ]

                              [ Open Codex ]
```

Directories include the registered Project root and existing Git worktrees.
The selector uses the same menu as Files and always shows the current directory,
including for a single-directory Project. Selection is independent of Files.
Changing Project resets the directory to its root; the selected Provider stays
in component memory, initially Codex. Roam does not create Git worktrees.

Open creates a Herdr Workspace in the selected directory, starts Codex or Claude,
waits for interactive readiness, and opens its Agent Terminal. Native terminal
input handles the initial and follow-up conversation, including provider-owned
keyboard shortcuts. Startup
does not wait for a provider Session ID or create synthetic Session records.

The form disables submission during directory loading, unavailable runtime, and
startup. Errors preserve the selected options. If startup partially succeeded,
Open Agent and Copy attach provide recovery; Start another Agent explicitly
enables a separate new launch. If the user leaves during startup, the result is
retained for its originating Project without taking over the current page.

Once Herdr exposes a native Session ID, the Agent page resolves its cwd
against registered Project workspaces, including external worktrees, and offers
Open Session. It never automatically navigates when the ID arrives. Provider
history remains the source for the Sessions list; empty native histories may
appear as Untitled session when discoverable.

## Session Conversation

Selecting a Session opens or reuses its Workbench tab. Multiple Sessions can
remain open across projects. Herdr runtime state marks a Session as live when
an Agent reports the same provider Session ID. A live Session offers Open Agent
for further interaction; a historical Session remains readable and offers Resume.

```text
┌────────────────────────────┬──────────────────────────────────────────────────────────┐
│ ROAM                Herdr● │ API review                       done · Codex · 28m      │
├────┬───────────────────────┼──────────────────────────────────────────────────────────┤
│ P  │ herdr-roam         ▾  │ You                                                      │
│    │ Workbench             │ Review the public API and record actionable findings.   │
│ A  │                       │                                                          │
│    │ Sessions          14 ▾│ Codex                                                    │
│ S  │ Search sessions...    │ I found two compatibility risks. The complete report is  │
│    │ API review       done │ available at docs/api-review.md.                         │
│    │ Product scan  working │ Artifacts                                                 │
│    │ Auth design      idle │ docs/api-review.md                              [Open]    │
│    │                       │                                                          │
│ ⚙  ├───────────────────────┤                                              [Resume]  │
│    │ 4 agents · 1 blocked  │                                                        │
└────┴───────────────────────┴────────────────────────────────────────────────────────┘
```

Provider adapters read the native Codex and Claude JSONL histories directly.
The transcript renders user and assistant messages, image references, and
collapsible tool activity with bounded input and output previews. Roam does not copy this content into browser storage,
configuration, or a database, and it never reconstructs a conversation from
terminal screen text. Missing, inaccessible, or malformed provider history is
shown as an explicit Session error.

Large Session catalogs use server-side cursor pages rather than mounting every
row. The sidebar keeps one 50-row page and offers Newer and Older navigation;
title filtering runs on the server after a short input debounce. Session browsing
stays in the sidebar; the Workbench remains focused on opening a new Session.

Long transcripts open at the latest bounded page. Earlier, Newer, and Latest
replace the visible page instead of accumulating unbounded Markdown nodes. Each
page is constrained by entry count, rendered content size, and raw JSONL scan
size. A native record above the per-record safety limit becomes an explicit
omission row. Live Sessions consume append-only deltas while viewing the latest
page and suspend polling on older pages.

Session always displays the durable native transcript, with no composer, runtime
view switch, Stop action, or focus-mode control. Resume starts or reuses the
native Session in its valid historical working directory and opens the Agent.
If the user has left the Session before Resume completes, it does not change
the active page. A running Session offers Open Agent. Reading remains available
when Herdr is disconnected; older pages are not replaced by runtime updates.

Session History centers the message body itself as a technical reading column
capped at 48rem. Provider and user labels sit in a narrow metadata rail
beside that column and move above the message when the panel is too narrow.
Tool activity, omission notices, and history pagination share the same reading
axis. History pagination is an in-flow control above the transcript rather than
a sticky toolbar, so it never overlaps message metadata.

Blocked Agents use their native Terminal for approval interaction. No hidden
keyboard bridge or automatic approval is used.

## Agents

Agents is the cross-project live-runtime view. The left pane answers how many
agents are working and which ones need attention. The main pane inspects one
selected agent.

Agent Tabs use `/agents/:agentId` and remain independent of the active Project.
The main pane directly shows the native Terminal. There is no Preview switch,
separate Prompt composer, or Focus in Herdr action. The header retains Open
Session when resolvable, Stop Agent… with confirmation, and Copy attach. A separated
Details icon toggles the metadata panel on demand. Terminal connection status
shares this header and is labeled separately from Agent work status. Connected
Terminal has no second toolbar or Disconnect action. Reconnect appears in the
header after failure or disconnection; busy ownership offers Observe and Take
over. Only recovery states show an explanatory row above the terminal screen.

## Browser Terminal

Terminal lazy-loads xterm.js on Agent entry and attempts one control connection
without takeover. If the runtime is initially unavailable, it waits until the
runtime first becomes available. Ordinary rerenders and status refreshes do not
reconnect. Terminal handles native keyboard input, IME and text paste; Escape
is native input, not a view-exit shortcut.

Switching away from or closing the Agent resource Tab unmounts Terminal and
releases its connection and control, not the Agent. Returning mounts Terminal
again and attempts a fresh connection. Within one visit, connection failure,
takeover, or runtime loss after connection requires explicit Reconnect.
Disconnection preserves the last visible screen and disables input;
input is never replayed.

Closing the browser page also releases its connection when the WebSocket closes;
merely switching browser tabs does not. Stop Agent… closes the native Agent
process and Herdr Pane, not just the browser connection, and requires confirmation.

Images use ordinary local file-path text. Recognition and file reading belong
to the native Agent, not xterm.js. There is no separate upload or clipboard-image
component. Paths must be accessible on the Agent host; another machine's local
paths are not supported by this flow.

Only one direct attach client owns input. When another client already controls
the terminal, Roam never takes over silently:

```text
This terminal is controlled by another client.

[Observe]   [Take over]
```

`Copy attach` copies the standard `herdr agent attach <target>` command. Roam
does not launch an external terminal process.

## Deferred Cross-Project Sessions

The first version browses conversation history inside the active Project.
Cross-project Session history and search remain a later capability; Agents
continues to provide the cross-project view for live runtime coordination.

## Skills

Skills is a global capability view over the existing user-level and
project-level Skill directories. Roam does not require a proprietary Skill
format or copy Skills into a database.

```text
┌──────────────────────────┬────────────────────────────────────────────────────────────┐
│ [Skills]                 │ frontend-design                    Project · Codex         │
│                          │────────────────────────────────────────────────────────────│
│ Search skills...      ↻ │ Rendered SKILL.md                         │ Contents        │
│ Project · herdr-roam  2 │                                           │ Overview        │
│ frontend-design  Codex  │ Guidance for distinctive, intentional    │ references/     │
│ project-release  Claude │ visual design...                          │ scripts/        │
│ Personal            41 │                                           │ assets/         │
│ agent-browser    Agents │                                           │                 │
│ frontend-design Claude │                                           │                 │
└──────────────────────────┴────────────────────────────────────────────────────────────┘
```

The list scans `.agents/skills`, `.codex/skills`, and `.claude/skills` at the
personal and active-project roots. Project and Personal remain continuous
groups rather than filter modes. Same-name Skills are separate resources and
carry a compact source label. Search filters both groups; Refresh performs a
fresh filesystem read. Unreadable or malformed Skills remain observable in a
collapsed warning summary without hiding valid entries.

Opening a Skill creates or activates one Workbench tab. `SKILL.md` is its
Overview; supporting directories load on expansion and files replace the
document inside that same tab. Relative Markdown links and images resolve
against the Skill root. The Contents state survives ordinary tab switching but
is not encoded into the route, so a full reload returns to Overview. Skills are
read-only: installation, editing, enablement, and remote catalogs remain later
product decisions.

## Project Issues

Issues appears when the project has configured the optional
`herdr-roam-issues` convention. The Issue directory is project-selected and its
location is stored in a minimal Git-tracked project configuration.

```text
┌──────────────────────────┬────────────────────────────────────────────────────────────┐
│ Issues · main       ↻    │ 1f0d3edd · docs/issues/1f0d3edd-….md                 ↻    │
│ Search issues...      1  │────────────────────────────────────────────────────────────│
│ Open 1                   │ Prepare the first Herdr Roam release                       │
│ ● Prepare first release  │ open · task · p0 · release                                 │
│   1f0d3edd · task · p0   │                                                            │
│                          │ Prepare a small, reproducible first release.                │
│ Closed 0                 │                                                            │
│                          │ ☑ Integrate the real Git-backed Issue view                 │
│                          │ ☐ Add installation and startup documentation               │
└──────────────────────────┴────────────────────────────────────────────────────────────┘
```

Each Issue is one Markdown file. YAML Front Matter holds its status and optional
type, priority, and labels, while the Markdown body holds the description and
task list. The dedicated interface is read-only; task checkboxes reflect source
state and cannot be changed in the browser. An Agent writes through the
`herdr-roam-issues` Skill, and explicit Sidebar or Detail Refresh reads the new
file state. Invalid files remain visible as warnings without hiding valid Issues.

## Deferred Loops

Loops are not exposed in the first release. A future Loop may save a time-based
or condition-based trigger that creates an ordinary Session in a selected
directory; it must not introduce a second runtime or conversation type.

## Project Files

Files provides a read-only project tree and a content-specific reader. It does
not become a Web IDE.

```text
┌──────────────────────────┬────────────────────────────────────────────────────────────┐
│ herdr-roam / Files       │ docs/product/vision-and-scope.md                          │
│                          │ Preview | Source                                           │
│ Search files...         │────────────────────────────────────────────────────────────│
│                          │                                                            │
│ docs/                    │ # Vision and Scope                                         │
│   architecture/         │                                                            │
│   design/               │ Herdr Roam is a local personal AI software studio...       │
│   product/              │                                                            │
│ packages/                │                                                            │
│ web-packages/            │                                                            │
│ ui-packages/             │                                                            │
└──────────────────────────┴────────────────────────────────────────────────────────────┘
```

Opening a file creates or reuses its Workbench tab regardless of whether the
entry point is Files, a Session artifact, an Issue, a Skill, or search. Markdown
defaults to Preview and supports Source. Code uses syntax highlighting;
unsupported or oversized files return an explicit state instead of blank output.

## Common States

- **Herdr unavailable:** preserve navigation and drafts, report the failed
  prerequisite, and provide Retry and diagnostics rather than empty Agent data.
- **No active project:** prompt the user to select or add a directory before
  showing the New Session form.
- **No agents:** explain that starting work creates the first Agent.
- **Blocked agent:** elevate the row; opening the Agent shows its native Terminal
  for approval interaction without automatically approving anything.
- **Stale connection:** show reconnecting state, then reload an authoritative
  Herdr snapshot before applying live updates.
- **Keyboard use:** support command search, dimension switching, list movement,
  opening the selected item, and using the native Terminal without requiring a mouse.

## Deferred Visual Decisions

This document does not select color tokens, typography, iconography, component
radii, motion, or responsive behavior. Those decisions require a separate visual
design baseline after the interaction model is accepted.

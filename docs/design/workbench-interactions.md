# Workbench Interactions

## Status

Draft. This document records the agreed desktop interaction model for Herdr
Roam. It is a product wireframe, not a visual design system or an implementation
specification.

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
│       ├── Loops
│       └── Files
├── Agents                 cross-project live runtime
└── Skills                 user skills and active-project skills
```

Projects, Agents, and Skills are global dimensions. Sessions, Issues, Loops,
and Files live inside the active project. Theme is a direct utility control,
not another resource dimension or route-backed destination.

These resources remain orthogonal. A Loop can create a Session, and a Session
can use a Skill to read or write Issues, but one resource does not own the
others.

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
`aria-current`. The project panel begins with one compact row for Sessions,
Issues, Loops, and Files, followed by the selected resource browser. Switching
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
availability, while the Agent list and Inspector explain connection failures or
stale data where those conditions block an action. A dedicated Runtime page,
diagnostics workflow, and server-ownership preference are deferred until the
next product-design phase defines the problem they solve.

## Project Workbench

The Workbench is the default page for the active project. It starts standard
Sessions and summarizes recent project activity without becoming a dashboard.

```text
┌────────────────────────────┬──────────────────────────────────────────────────────────┐
│ ROAM                Herdr● │ herdr-roam / Workbench                                  │
├────┬───────────────────────┼──────────────────────────────────────────────────────────┤
│ P  │ herdr-roam         ▾  │                 Start work in herdr-roam                 │
│    │ Workbench             │  Directory  /work/herdr-roam                        ▾   │
│ A  │                       │  Agent      Codex                                    ▾   │
│    │ Sessions          14 ▾│  Name       optional                                   │
│ S  │ Search sessions...    │                                                          │
│    │ ● Product scan    now │  ┌────────────────────────────────────────────────────┐  │
│    │ ● API review      12m │  │ Describe the work...                               │  │
│    │                       │  └────────────────────────────────────────────────────┘  │
│    │                       │                                            Start  ↵      │
│ ⚙  ├───────────────────────┤  Recent activity                                       │
│    │ 4 agents · 1 blocked  │  10:42  codex-api finished a review                   │
└────┴───────────────────────┴──────────────────────────────────────────────────────────┘
```

Starting work creates the required Herdr Workspace, starts the selected native
Agent, submits the Prompt, and opens its live Agent Inspector. Workspace and
Pane creation remain hidden implementation details. This flow does not create a
synthetic Session or infer conversation history from terminal output.

If creation fails, Roam keeps the draft Prompt. A Workspace created before the
failure is preserved with a terminal attach command so the user can diagnose or
continue natively.

## Session Conversation

Selecting a Session opens or reuses its Workbench tab. Multiple Sessions can
remain open across projects. Herdr runtime state marks a Session as live when
an Agent reports the same provider Session ID. A live Session accepts another
Prompt; a historical Session remains readable and offers Resume.

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
│ ⚙  ├───────────────────────┤ ┌──────────────────────────────────────────────────────┐ │
│    │ 4 agents · 1 blocked  │ │ Continue this Session...                            │ │
└────┴───────────────────────┴─┴──────────────────────────────────────────────────────┴─┘
```

Provider adapters read the native Codex and Claude JSONL histories directly.
The transcript renders user and assistant messages, image references, and
collapsible tool activity with bounded input and output previews. Roam does not copy this content into browser storage,
configuration, or a database, and it never reconstructs a conversation from
terminal screen text. Missing, inaccessible, or malformed provider history is
shown as an explicit Session error.

Large Session catalogs use server-side cursor pages rather than mounting every
row. The sidebar keeps one 50-row page and offers Newer and Older navigation;
title filtering runs on the server after a short input debounce. The Workbench
home requests only its eight recent rows.

Long transcripts open at the latest bounded page. Earlier, Newer, and Latest
replace the visible page instead of accumulating unbounded Markdown nodes. Each
page is constrained by entry count, rendered content size, and raw JSONL scan
size. A native record above the per-record safety limit becomes an explicit
omission row. Live Sessions consume append-only deltas while viewing the latest
page and suspend polling on older pages.

An offline Session opens in History and has no composer. Resume asks the server
to start Codex or Claude with its native Session ID in the historical working
directory. The directory must still resolve inside the registered Project. A
successful Resume switches directly to Live; a currently running Session is
reused rather than resumed a second time.

Live uses the same dark runtime surface as an Agent tab, including recent ANSI
output, blocked input, and the shared Prompt composer. Session and Agent routes
remain distinct because their surrounding task context differs. A compact
Live/History control switches between the native transcript and runtime surface;
React Activity keeps each mounted view's local state. Runtime status changes do
not override an explicit History selection. If the matching Agent disappears
while Live is selected, the Session returns to History. `Open Agent` remains an
explicit route transition to the Agent-oriented header and controls.

Session History centers the message body itself as a technical reading column
capped at 48rem. Provider and user labels sit in a narrow metadata rail
beside that column and move above the message when the panel is too narrow.
Tool activity, omission notices, and history pagination share the same reading
axis. History pagination is an in-flow control above the transcript rather than
a sticky toolbar, so it never overlaps message metadata. Focus Mode temporarily
overlays the whole workbench over the sidebar while
retaining the Tab Bar and Session header. Escape or any resource navigation
exits Focus Mode; it does not invoke browser fullscreen.

When the selected Agent is `blocked`, the Prompt composer is replaced by a
click-to-focus terminal input bridge, without adding a visible response toolbar.
Before input activation, the surface remains read-only, is reachable with Tab,
and entering `blocked` never steals keyboard input. Enter or an unselected click
activates input. Native navigation keys, Enter, Escape, Tab, Shift+Tab, ordinary
text, IME commits, and paste are then sent to the Agent in order. Escape is
queued, then focus returns to the safe terminal surface; Shift+Tab stays in input
mode and is forwarded unchanged. A subtle focus ring and screen-reader
instructions are the only added state indicators. Clicking outside stops input, while selecting
terminal text does not activate it. Successful input requests output refreshes
without waiting for those reads. Roam coalesces concurrent refresh requests and
does not parse ANSI output into browser-owned questions or assign meaning to
provider-owned keys such as `Shift+Tab`.

## Agents

Agents is the cross-project live-runtime view. The left pane answers how many
agents are working and which ones need attention. The main pane inspects one
selected agent.

```text
┌──────────────────────────┬────────────────────────────────────────────────────────────┐
│ ROAM                    ● │ ● codex-api  idle · Codex  Focus in Herdr  Copy attach    │
│                          │   /work/herdr-roam                                      │
│ Projects [Agents] Skills ├────────────────────────────────────────────────────────────┤
│ Blocked                1 │                                                            │
│ ◉ claude-ui              │ • Read server routes                                      │
│                          │ • Found two compatibility risks                            │
│ Idle                   2 │ • Updated docs/api-review.md                               │
│ ● codex-api             │                                                            │
│   Codex · /work/api      ├────────────────────────────────────────────────────────────┤
│                          │ ❯ Send a follow-up…                                        │
│                          │                                               done · ↵ send │
└──────────────────────────┴────────────────────────────────────────────────────────────┘
```

The implemented Inspector reads recent unwrapped ANSI terminal output on a
fixed dark surface without a separate output heading. It sends bounded Prompts
through Herdr while the Agent is `working`, `idle`, or `done`: Enter sends and
Shift+Enter inserts a newline. Shift+Tab is sent directly to the Agent instead
of changing browser focus or introducing a Roam-owned mode selector. Pasting a
PNG, JPEG, or WebP into the composer adds a removable thumbnail. Images remain
browser-local until submission, then the local server stages temporary files
and pastes their paths into the native Agent composer. Text, images, or both may
form a Prompt. It does not reconstruct a chat transcript.
Details open on demand instead of permanently reducing the reading surface.
Agent Tabs use `/agents/:agentId`; they remain independent of the active
Project. `Focus in Herdr` selects the Agent's native Pane without simulating
terminal control in Roam. Direct terminal input is available only while the
Agent reports `blocked`; it is a focused response bridge rather than a persistent
browser Attach session.

## Deferred Browser Terminal Attach

Terminal is an explicit secondary mode inside Agent detail. It replaces the
Inspector in the main pane and loads a terminal renderer only while attached.

```text
┌──────────────────────────┬────────────────────────────────────────────────────────────┐
│ Live agents              │ codex-api                                      attached   │
│                          │ [Inspector] [Terminal]          Copy command     Detach     │
│ ● codex-api             │────────────────────────────────────────────────────────────│
│ ◉ claude-ui             │                                                            │
│ ◌ codex-tests           │  native Codex terminal                                    │
│                          │                                                            │
│                          │  › continue with the compatibility report                  │
│                          │                                                            │
│                          │                                                            │
│                          │                                                            │
└──────────────────────────┴────────────────────────────────────────────────────────────┘
```

Only one direct attach client owns input. When another client already controls
the terminal, Roam never takes over silently:

```text
This terminal is controlled by another client.

[Observe read-only]   [Take over]   [Cancel]
```

`Copy command` copies the standard `herdr agent attach <target>` command. Roam
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
│ herdr-roam / Issues      │ HR-018  Clarify automatic runtime ownership                │
│                          │ open · runtime · discovered                                │
│ Search issues...        │────────────────────────────────────────────────────────────│
│ Open 24  Closed 81       │ Roam should start Herdr for regular users while preserving │
│                          │ an external-server mode for advanced users.                 │
│ HR-018 Runtime ownership │                                                            │
│ HR-017 Session fallback  │ Labels                                                     │
│ HR-014 Skill discovery   │ runtime  onboarding                                        │
│                          │                                                            │
│                          │ Referenced files                                            │
│                          │ docs/design/workbench-interactions.md                       │
│                          │                                                            │
│                          │                                           Edit   Close      │
└──────────────────────────┴────────────────────────────────────────────────────────────┘
```

Each Issue is one Markdown file. YAML Front Matter holds the minimal structured
GitHub-like core, while the Markdown body holds the description and reviewable
context. Roam presents this through a dedicated structured Issue interface;
Skills may interpret labels or an optional stage without forcing a global
production lifecycle.

## Project Loops

A Loop is a saved trigger that creates a normal Session in a directory and sends
a Prompt. It is not a second agent runtime or a special conversation type.

```text
┌──────────────────────────┬────────────────────────────────────────────────────────────┐
│ herdr-roam / Loops       │ Product exploration                         enabled        │
│                          │────────────────────────────────────────────────────────────│
│ + New loop               │ Trigger       Every day at 09:00                          │
│                          │ Directory     /work/herdr-roam                             │
│ ● Product exploration   │ Agent         Codex                                       │
│   next 09:00             │ Prompt        Use the product exploration Skill...         │
│                          │                                                            │
│ ○ Ready issue producer  │ Next run      Tomorrow at 09:00                            │
│   paused                 │ Last run      Session: Product scan             [Open]     │
│                          │                                                            │
│                          │ Run history                                                │
│                          │ today 09:00     done      Product scan                      │
│                          │ yesterday      done      Product scan                      │
│                          │                                  Run now   Pause   Edit     │
└──────────────────────────┴────────────────────────────────────────────────────────────┘
```

Triggers may be time-based or condition-based. Once triggered, everything after
Session creation follows standard Herdr and agent behavior.

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
  showing the Workbench composer.
- **No agents:** explain that starting work creates the first Agent.
- **Blocked agent:** elevate the row and explain that Inspector may be enough;
  offer Browser Attach for the native approval UI.
- **Stale connection:** show reconnecting state, then reload an authoritative
  Herdr snapshot before applying live updates.
- **Keyboard use:** support command search, dimension switching, list movement,
  opening the selected item, and focusing the Prompt without requiring a mouse.

## Deferred Visual Decisions

This document does not select color tokens, typography, iconography, component
radii, motion, or responsive behavior. Those decisions require a separate visual
design baseline after the interaction model is accepted.

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
├── Skills                 user skills and active-project skills
└── Settings               application preferences
    └── Runtime            Herdr ownership and diagnostics
```

Projects, Agents, and Skills are global dimensions. Sessions, Issues, Loops,
and Files live inside the active project. Settings is a utility destination
rather than another resource dimension.

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
│ H  ├───────────────────────┤                                                          │
│ ⚙  │ 4 agents · 1 blocked  │                                                          │
└────┴───────────────────────┴──────────────────────────────────────────────────────────┘
```

The Activity Bar contains Projects, Agents, and Skills at the top. Herdr Runtime
status and Settings sit at the bottom. Their icon buttons have accessible labels
and tooltips. The project panel begins with one compact row for Sessions, Issues,
Loops, and Files, followed by the selected resource browser.

Switching to Agents or Skills does not clear the active project. React Activity
keeps each contextual panel mounted, so returning restores its previous resource
selection, search, and scroll position. The Settings button and the persistent
Herdr status both open a temporary Runtime utility tab without changing the
active project. A compact `PanelLeft` control in the project header collapses
the sidebar to the Activity Bar and restores its previous width. While collapsed,
the ROAM mark remains visible and changes into the expand control on hover or
keyboard focus. Selecting a global Activity also expands the sidebar, and the
collapsed state survives reload.

### Workbench tabs

Workbench is a fixed project home. Session, Issue, File, and Skill resources
open to its right using one shared tab foundation. Opening an existing resource
activates its tab instead of creating a duplicate. Tabs can span projects and
show project context when names collide; activating a cross-project tab does
not silently change the active project.

Closing a tab closes only the view. It does not stop an Agent, close an Issue,
or modify a file. Closing the active tab selects its right neighbor, then its
left neighbor, then Workbench. Inactive tabs retain local view state such as a
Session draft or Markdown Preview/Source mode. Overflow scrolls horizontally;
tabs are never hidden to fit the viewport.

The active resource is represented by a deep-linkable URL. The ordered tab set
is an interface preference stored in the browser and contains resource
references only, not copied Session, Issue, File, or Skill content.
Canonical Project routes and restoration behavior are defined in
[Project Registry and Routing](../architecture/project-registry-and-routing.md).

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
│                          │                  [Runtime settings]   [Diagnostics] [Retry] │
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

### Settings / Runtime

Runtime ownership is a global preference. It is not shown as onboarding or as
a choice that blocks normal startup. Roam-managed is applied by default; a user
only visits this page to inspect diagnostics or change ownership.

```text
Settings / Runtime

Herdr status       Connected · default server                    [Diagnostics]

Server ownership

(●) Roam-managed
    Connect to the default Herdr server. Start it when it is not running.
    Leave running agents alive when Roam exits.

( ) Externally managed
    Connect to a Herdr server started and managed by the user.
    Never start or stop it from Roam.
```

Changing this setting affects server lifecycle ownership only. It does not
change Agent creation, project behavior, or the rest of the Web interface.

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

Starting work creates the required Herdr runtime location, starts the selected
native agent, submits the Prompt, and opens the new Session. Workspace and Pane
creation remain hidden implementation details.

If the selected agent CLI is missing or not authenticated, Roam keeps the draft
Prompt and reports the failed prerequisite instead of starting a broken
Session.

## Session Conversation

Selecting a Session opens or reuses its Workbench tab. Multiple Sessions can
remain open across projects, and inactive tabs continue to show working,
blocked, done, and unread state. A live Session accepts another Prompt; a
historical Session offers Resume.

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

Provider adapters may enrich a transcript when structured history is available.
Terminal text remains the fallback; Roam must not invent message boundaries from
unreliable screen parsing.

## Agents

Agents is the cross-project live-runtime view. The left pane answers how many
agents are working and which ones need attention. The main pane inspects one
selected agent.

```text
┌──────────────────────────┬────────────────────────────────────────────────────────────┐
│ ROAM              Herdr● │ codex-api                                  working · 12m   │
│                          ├────────────────────────────────────────────────────────────┤
│ Projects [Agents]        │ herdr-roam · Codex · API review                            │
│ Sessions Skills          │                                                            │
│                          │ [Inspector] [Terminal]       Copy attach command  Interrupt │
│ Working 3  Blocked 1     │────────────────────────────────────────────────────────────│
│ Done 1     Idle 2        │ Recent terminal output                                     │
│                          │                                                            │
│ ● codex-api             │ • Read server routes                                       │
│   herdr-roam     working │ • Found two compatibility risks                            │
│                          │ • Writing docs/api-review.md                                │
│ ◉ claude-ui             │                                                            │
│   storefront     blocked │                                                            │
│                          │                                                            │
│ ◌ codex-tests           │ ┌────────────────────────────────────────────────────────┐ │
│   core             done  │ │ Send a Prompt...                                      │ │
│                          │ └────────────────────────────────────────────────────────┘ │
└──────────────────────────┴────────────────────────────────────────────────────────────┘
```

The Inspector reads Herdr's plain or ANSI terminal output and sends ordinary
Prompts through the Herdr agent API. It is not a reconstructed chat transcript.

## Browser Terminal Attach

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
│ [Skills]                 │ frontend-design                              user skill     │
│                          │────────────────────────────────────────────────────────────│
│ Scope                    │ Rendered SKILL.md                                          │
│ [Effective] User Project │                                                            │
│                          │ Guidance for distinctive, intentional visual design...     │
│ Search skills...        │                                                            │
│                          │ Resources                                                   │
│ frontend-design         │ scripts/                                                    │
│ impeccable              │ references/                                                 │
│ herdr-roam-issues       │ assets/                                                     │
│ project-release         │                                                            │
│                          │ Source                                                      │
│                          │ user-level skill                                [Reveal]   │
└──────────────────────────┴────────────────────────────────────────────────────────────┘
```

Effective combines the user-level Skills with Skills from the active project.
Installation and broader catalog behavior remain a separate product decision.

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

# Vision and Scope

## Status

Herdr Roam is in its early design stage. This document defines the direction and
the boundary of its first implementation.

## Product Definition

Herdr Roam is a local personal AI software studio for coordinating multiple
coding agents managed by one Herdr server.

It gives a human one place to understand concurrent work across projects,
inspect the artifacts agents produce, identify work that needs attention, and
keep software work moving through reusable Skills, Issues, and Loops.

Herdr Roam does not replace Herdr or terminal-oriented clients such as
herdr-gui. Herdr owns processes, PTYs, and runtime state. Herdr Roam owns the
coordination and human-readable layer above them, with an explicit Browser
Attach mode when native terminal interaction is required.

## The Problem

Running several agents concurrently creates a coordination problem that a list
of terminal panes does not solve:

- A person needs to know which agent is active, blocked, waiting, or finished.
- Work is distributed across projects and conversation histories.
- Important results are often documents, plans, code, or diffs rather than the
  terminal screen itself.
- Reviewing an artifact and deciding what happens next should not require
  attaching to every running process.
- When terminal interaction is needed, the transition should remain immediate.

Herdr Roam is designed around this loop:

1. Observe parallel agent activity.
2. Find the work that needs human attention.
3. Read the relevant output and artifacts in an appropriate viewer.
4. Give lightweight direction or open the agent in a terminal.
5. Return to the global view and continue coordinating.

## Product Principles

### Coordinate work, not panes

The primary model is project and agent activity, not Herdr workspaces, tabs, or
panes. Herdr identifiers remain implementation details unless they are required
for diagnostics or attachment.

### Make artifacts first-class

Terminal output is useful for live progress, but it is not the primary reading
experience. Markdown documents, source code, diffs, and other reviewable outputs
should be presented in human-readable views suited to their content.

### Keep the human in the coordination loop

Herdr Roam helps a person notice, inspect, decide, and redirect. Saved Loops can
create ordinary Sessions on a schedule or condition, but they do not introduce
a second agent runtime or an opaque agent-to-agent coordination system.

### Preserve native agent behavior

Codex and Claude continue to run through their native CLIs under Herdr. Herdr
Roam does not rebuild their execution loop with an SDK.

### Keep terminal interaction explicit

The Web interface defaults to overview, reading, and lightweight control. A
person explicitly enters Browser Attach or copies a standard Herdr attach
command when the native terminal interface is required.

## Core Concepts

- **Project**: a working directory, normally rooted at a Git root and registered
  under a unique, stable Project Name.
- **Agent**: a Codex or Claude process currently managed by Herdr.
- **Conversation Session**: a resumable Codex or Claude conversation, whether
  or not an agent is currently running for it.
- **Issue**: an optional Git-backed unit of work stored through an open format
  supplied by the `herdr-roam-issues` Skill.
- **Loop**: a saved time-based or condition-based trigger that creates a normal
  Session in a selected directory and sends a Prompt.
- **Artifact**: a human-reviewable result associated with work, such as a
  Markdown document, source file, or diff.
- **Skill**: an existing user-level or project-level instruction resource
  available to an agent.
- **Host**: the machine running Herdr and Herdr Roam. The first version supports
  one local host only.

A Herdr server session, workspace, tab, and pane belong to the runtime model.
They are not top-level product concepts in Herdr Roam.

## First-Version Capabilities

### Active project workbench

One project is active at a time. Its Workbench starts standard Sessions from a
directory and presents a compact project activity stream. Project work includes
Sessions, Issues, Loops, Files, and effective project Skills.

The Workbench starts a named or automatically named Codex or Claude agent in
the selected directory without exposing Herdr Workspace or Pane setup.

The main work area uses one shared tab foundation. Sessions, Issues, files,
artifacts, and Skills can remain open together, including resources from
different projects. Closing a tab closes only its view and never changes the
underlying resource or Agent.

### Cross-project agents

The Agents view presents live agents across projects and prioritizes attention
over layout. It distinguishes states supplied by Herdr from states inferred by
Herdr Roam and does not equate an idle process with completed work.

Each agent summary should expose its name, kind, project, current state, recent
activity, a small recent-output preview, related conversation, and an attach
action.

### Attention view

The interface brings together agents that appear to require input, approval, or
investigation. Working, idle, done, blocked, and unknown agents remain visible
without competing equally for attention.

### Agent inspection and terminal attach

A person can inspect recent output, start a named Codex or Claude agent in a
selected project, interrupt or stop an agent, and send a bounded instruction
when that operation is supported safely by Herdr.

The default Agent detail uses a text Inspector and Prompt input. Browser Attach
loads the native terminal only after an explicit action. Roam also copies the
standard attach command for use in an existing terminal, but it does not launch
external terminal processes.

### Artifact and project reading

Projects provide a read-only file tree with dedicated rendering for Markdown
and syntax-highlighted source code. Common context files such as `README.md`
and `AGENTS.md` are easy to reach. Git branch and working-tree state provide
review context without turning Herdr Roam into a Git client.

Opening a file from the tree, a Session, an Issue, a Skill, or search uses the
same Workbench tab rather than a viewer owned by the entry point.

Artifact discovery starts from files and runtime context already available on
the local machine. A separate task or artifact database is not part of the first
version.

### Git-backed Issues

The optional `herdr-roam-issues` Skill gives agents deterministic tools and
instructions for producing and consuming local Issues. A project selects its
Issue directory in a minimal Git-tracked configuration. Each Issue is one
Markdown file: YAML Front Matter contains its structured GitHub-like core and
the Markdown body contains human-readable context. Skills may use labels or an
optional stage without forcing one production workflow on every project.

### Loops

A Loop persists a trigger, project directory, agent choice, and Prompt. When a
time or condition trigger fires, Roam creates an ordinary Session and submits
the Prompt. The resulting Agent, Session, files, and Issues retain their normal
semantics.

### Existing Skills

Skills are visible as a first-class resource rather than hidden in the file
tree. A person can browse user-level and active-project Skills, read their
instructions and supporting resources, see their source, and understand the
effective Skill set for the active project. Roam uses the existing Agent Skill
layout rather than introducing a proprietary Skill format or database.

Installation, catalog, grouping, and in-browser authoring behavior remain open
product decisions.

### Herdr runtime ownership

Herdr and at least one authenticated agent CLI are prerequisites. Roam detects
and reports missing prerequisites but does not install or teach them. By
default, Roam connects to the default Herdr server or starts it when absent.
Advanced users can change the global Runtime setting so they own the Herdr
server lifecycle themselves. Runtime ownership is not a first-run choice.

## Information Architecture

```text
Herdr Roam
├── Projects
│   └── Active Project
│       ├── Workbench
│       ├── Sessions
│       ├── Issues
│       ├── Loops
│       └── Files
├── Agents
├── Skills
└── Settings
    └── Runtime
```

The default desktop shell uses a contextual sidebar and one main work surface.
Settings is a utility destination rather than a fifth resource dimension;
Runtime is also reachable from the persistent Herdr connection status.
The detailed interaction model is documented in
[Workbench Interactions](../design/workbench-interactions.md).

## Explicit Non-Goals

The first version does not include:

- a terminal-first replacement for herdr-gui or Herdr's workspace layout;
- PTY, process, or terminal multiplexing owned by Herdr Roam;
- a Web IDE or file editing;
- an opaque autonomous planner or agent-to-agent conversation runtime;
- comprehensive Git, commit, merge, or worktree management;
- multiple Herdr servers or remote hosts;
- multiple users, access control, or public Internet deployment;
- a Codex SDK or Claude Agent SDK runtime;
- cross-project conversation history and search; Sessions are browsed within
  the active Project in the first version;
- a database for Issues, Loops, artifacts, or copied runtime state.

These boundaries keep the first version focused on concurrent visibility,
human-readable review, and human-directed coordination.

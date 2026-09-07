# Vision and Scope

## Status

This document defines the direction and boundary of the first local release.

## Product Definition

Herdr Roam is a local personal AI software studio for coordinating multiple
coding agents managed by one Herdr server.

It gives a human one place to understand concurrent work across projects,
inspect the artifacts agents produce, identify work that needs attention, and
keep software work moving through reusable Skills and native project tools.

Herdr Roam does not replace Herdr or terminal-oriented clients such as
herdr-gui. Herdr owns processes, PTYs, and runtime state. Herdr Roam owns the
coordination and human-readable layer above them. Agent pages provide native
Terminal interaction; Session and artifact pages provide durable reading.

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

Herdr Roam helps a person notice, inspect, decide, and redirect. It does not
introduce an opaque agent-to-agent coordination system.

### Preserve native agent behavior

Codex and Claude continue to run through their native CLIs under Herdr. Herdr
Roam does not rebuild their execution loop with an SDK.

### Keep terminal interaction explicit

Overview, Session, and artifact pages do not acquire terminal control. Opening
an Agent page connects its native Terminal automatically without taking over
another controller. A copied Herdr attach command remains available for an
external terminal.

## Core Concepts

- **Project**: a working directory, normally rooted at a Git root and registered
  under a unique, stable Project Name.
- **Agent**: a Codex or Claude process currently managed by Herdr.
- **Conversation Session**: a resumable Codex or Claude conversation, whether
  or not an agent is currently running for it.
- **Loop**: a deferred time-based or condition-based trigger that would create a
  normal Session in a selected directory and send a Prompt.
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
directory. Session browsing and global Runtime status remain in persistent
navigation instead of being repeated on the Workbench. Project work includes
Sessions, Files, and project-local Skills.

The Workbench starts a named or automatically named Codex or Claude agent in
the selected directory without exposing Herdr Workspace or Pane setup.

The main work area uses one shared tab foundation. Sessions, files, artifacts,
and Skills can remain open together, including resources from
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

Agent detail directly shows a lazy-loaded native Terminal, without a Preview
mode or separate Prompt composer. Roam also copies the standard attach command
for use in an existing terminal, but it does not launch external terminal processes.

Session pages always read durable native history; Resume and Open Agent lead
to the runtime page. All Prompt input, terminal interaction and Stop actions
belong to Agent pages.

Terminal uses xterm.js through Herdr's existing control/observe interface,
including native approval interaction for blocked Agents. Each entry attempts
one control connection when the runtime is available, without takeover. Leaving
the resource Tab releases control without stopping the Agent; returning starts
a new connection. Disconnection, failure, or takeover does not trigger automatic
retries within the current visit. Connection status shares the Agent header,
with Reconnect for recovery and no manual Disconnect action. Busy ownership
offers Observe and explicit Take over. Stop Agent… ends the native process only
after confirmation.

On the local host, users can enter an image file path directly into the native
Agent. The Agent interprets and reads that path; Terminal only transports text.
Roam adds no image uploader and does not promise access to paths on other machines.

### Artifact and project reading

Projects provide a read-only file tree with dedicated rendering for Markdown
and syntax-highlighted source code. Common context files such as `README.md`
and `AGENTS.md` are easy to reach. Git branch and working-tree state provide
review context without turning Herdr Roam into a Git client.

The tree reads the current Git-visible catalog in pages and searches paths on
the local server without maintaining a second index. Markdown, HTML, images,
source, and unsupported files receive explicit readers; uncommon rendering
engines load only when content needs them.

Opening a file from the tree, a Session, a Skill, or search uses the
same Workbench tab rather than a viewer owned by the entry point.

Artifact discovery starts from files and runtime context already available on
the local machine. A separate task or artifact database is not part of the first
version.

### External task trackers

Task tracking remains in systems such as GitHub Issues. Agents use the selected
tracker through its native tools and associate tasks with the repository there.
Herdr Roam does not define a local Issue format, mirror tracker data, or add a
tracker-specific browser and API.

### Deferred Loops

The Loops interface and scheduler are not part of the first release. A future
Loop may persist a trigger, project directory, agent choice, and Prompt while
creating an ordinary Session rather than a second run type.

### Existing Skills

Skills are visible as a first-class resource rather than hidden in the file
tree. A person can browse user-level and active-project Skills, read their
instructions and supporting resources, and see whether each resource came from
Agents, Codex, or Claude. Same-name Skills from different sources remain
separate and explicit; Roam does not manufacture one merged effective Skill.
It uses the existing local Skill layouts rather than introducing a proprietary
format, index, cache, or database.

The first version is read-only. Installation, enablement, remote catalogs, and
in-browser authoring remain later product decisions.

### Herdr runtime prerequisites

Herdr and at least one authenticated agent CLI are prerequisites. Roam detects
missing prerequisites and provides a concise installation or startup command,
but the user runs that command in a terminal. Roam connects automatically when
the default Herdr server becomes available; it does not own the server process.
Runtime availability is reported in the Agent list, Agent page, and
sidebar summary where it affects the current task. A dedicated Runtime surface
and configurable server ownership remain deferred until their product purpose
and required operations are defined.

## Information Architecture

```text
Herdr Roam
├── Projects
│   └── Active Project
│       ├── Workbench
│       ├── Sessions
│       └── Files
├── Agents
└── Skills
```

The default desktop shell uses a contextual sidebar and one main work surface.
Theme is a direct utility control in the Activity Bar rather than a resource
dimension. It does not create a Workbench tab or change the current route.
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
- a built-in Issue tracker or a mirror of external task records;
- scheduled or condition-based Loops;
- a database for tasks, Loops, artifacts, or copied runtime state.

These boundaries keep the first version focused on concurrent visibility,
human-readable review, and human-directed coordination.

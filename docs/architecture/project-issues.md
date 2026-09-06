# Project Issues

## Source of truth

Issues are ordinary files in the selected Git Worktree. Roam stores no Issue
index, copied body, task state, or write queue. The Worktree root opts in with:

```json
{
  "version": 1,
  "issues": { "directory": "docs/issues" }
}
```

Each direct `<uuid>.md` child of that directory begins with YAML Front Matter:

```yaml
id: 1f0d3edd-727e-4780-8c0e-47ec0fa6b12e
title: Prepare the first Herdr Roam release
status: open
type: task
priority: p0
labels: [release]
```

`type`, `priority`, and `labels` are optional. Missing labels are returned as an
empty array. The remainder is freeform Markdown; GFM task checkboxes are display
state, not browser controls.

The `herdr-roam-issues` Skill is the write interface. Agents run its CLI to
initialize, create, inspect, or atomically update Issue files. The Roam server
does not spawn the Skill and exposes no Issue mutation endpoint. Git provides
review, synchronization, and history for every change.

## Read API

```http
GET /api/projects/:projectName/workspaces/:workspaceId/issues
GET /api/projects/:projectName/workspaces/:workspaceId/issues/:issueId
```

The catalog returns metadata summaries and per-file warnings. One malformed or
unreadable file does not hide valid Issues. Detail returns the same metadata and
the Markdown body. Catalog order is `p0`, `p1`, `p2`, `p3`, then unassessed,
with UUID as the tie-breaker; the browser groups that order into Open and Closed.

The browser reads a catalog when entering a Workspace and reads detail when its
tab is active. It does not poll or subscribe to filesystem changes. Sidebar and
detail Refresh controls repeat their own read, so an Agent update becomes
visible only after the user requests it.

## Identity and safety

An Issue tab is identified by Project Name, Workspace ID, and UUID. Its canonical
route is `/projects/:projectName/issues/:workspaceId/:issueId`. Issues and Files
share the selected Workspace preference, while an already-open tab stays bound
to the Workspace encoded in its reference.

The server resolves Project and Workspace identifiers through the trusted local
Project Registry. `.herdr-roam.json`, the configured directory, and every Issue
file are resolved beneath that Workspace; traversal, Git metadata, and escaping
symlinks are rejected. Configuration is limited to 64 KiB, each Issue to 1 MiB,
and one catalog to 1000 Markdown files. Missing configuration and unavailable,
invalid, missing, or oversized resources remain distinct observable errors.

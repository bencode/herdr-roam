# Project Registry and Routing

## Project identity

Roam identifies a project by a unique, stable, human-readable Project Name.
The name is both the browser/server lookup key and the value used in URLs. A
Project Name uses lowercase letters, numbers, `.`, `_`, and `-`. It is not a
display label derived on every startup and it does not receive a random suffix.

The Roam server owns a versioned `config.json` in Roam's local application
configuration directory. The default path is
`~/Library/Application Support/herdr-roam/config.json` on macOS,
`${XDG_CONFIG_HOME:-~/.config}/herdr-roam/config.json` on Linux, and
`%APPDATA%\herdr-roam\config.json` on Windows:

```json
{
  "version": 2,
  "projects": [
    {
      "name": "herdr-roam",
      "path": "/Users/bencode/work/herdr-roam"
    },
    {
      "name": "archive-herdr-roam",
      "path": "/Users/bencode/archive/herdr-roam"
    }
  ],
  "ignoredProjectPaths": []
}
```

The array order is the default Project Selector order. Names are 1–64
characters, start with a lowercase letter or digit, use only lowercase letters,
digits, `.`, `_`, and `-`, and are unique. Canonical absolute paths are unique. The server may
build a transient lookup map after validation, but it preserves the array in
the file. Moving or renaming a registered Project is outside this version; remove
the old entry and add the new path instead.

The browser sends a Project Name for project operations and an absolute path
when the user explicitly adds a directory. The server canonicalizes the path,
resolves a Git directory to its worktree root, derives a URL-safe Project Name
from its basename, and appends a numeric suffix on a name collision. Runtime
availability and Git state are not stored.

A Project identifies one logical Git repository. Its registered `path` is the
primary Workspace, while every other live worktree sharing the same Git common
directory is another Workspace of that Project. Registering or discovering a
second worktree returns the existing Project instead of creating a duplicate.
For non-Git directories, the Project has exactly one Workspace. Workspace state
is derived from the filesystem and Git on each request; Roam does not create,
checkout, remove, or cache worktrees.

The server validates and canonicalizes a directory before adding it, then
writes the file through a temporary sibling and atomic rename. A missing file
means an empty registry; an invalid file is reported without being replaced or
silently treated as empty. Version 1 remains readable and is normalized to
version 2 on the next mutation.

Roam also listens to the authoritative Herdr Agent snapshot. A distinct Agent
working directory is resolved to its nearest Git root and added automatically.
Pane directories and non-Git Agent directories are ignored. Removing a Project
adds its canonical path to `ignoredProjectPaths`, preventing a still-running
Agent from immediately restoring it. Git ignore matching uses repository
identity, so an Agent in another worktree cannot restore the removed Project;
explicitly adding any worktree from that repository removes the ignore entry.

The Project Selector is the only user-facing Project entry point. It lists one
kind of persisted Project and contains Add and Manage modes without exposing
automatic versus manual provenance. When the registry is empty, `/projects`
renders the Project empty state. Runtime availability does not change project
registration or routing.

## Canonical routes

```text
/
/projects
/projects/:projectName
/projects/:projectName/sessions
/projects/:projectName/sessions/:provider/:sessionId
/projects/:projectName/files
/projects/:projectName/files/:workspaceId/:path...
/projects/:projectName/skills/:skillId
/agents
/agents/:agentId
/skills
/skills/:skillId
```

`/` restores the last global Activity and that Activity's last canonical path.
`/projects` restores the Projects Activity's last path. The collection routes
select the corresponding Activity or Project resource browser without inventing
a persisted content tab. The Sessions and Files controls inside
the Project sidebar are local browser switches: they do not create history
entries or replace the active resource route. Selecting a concrete resource is
the boundary that opens a Workbench tab and updates the route. A project
resource route identifies the owner of the resource; activating a cross-project
resource does not silently change the Project selected for browsing. Only
opening a Project Workbench, opening a Project collection route, or selecting a
Project changes the active Project.

Selecting a Project while Skills is active is a browsing-context change rather
than a route transition. The application stays in Skills, refreshes only the
Project group, and leaves any open Skill tab unchanged. The selected Project
therefore does not overwrite the last Activity or force an old Project Skill
tab to close.

The Activity is normally derived from the resource type. Project Sessions and
Files belong to Projects; Agents belong to Agents; and both
user and project Skills belong to Skills. Consequently,
`/projects/:projectName/skills/:skillId` selects the Skills Activity despite its
project-scoped canonical path.

Each path segment is URI encoded independently. The old
`/projects/:projectName/workbench` form is not a compatibility route because
the application is still pre-release. Removed `/projects/:projectName/issues`
routes are likewise unsupported and follow the application's unknown-route
fallback to the Project Workbench.

A Skill ID is source-qualified as `<source>:<directory-name>`, for example
`codex:frontend-design`. The whole ID is one encoded route segment. This keeps
same-name Skills from Agents, Codex, and Claude distinct without adding source
fields to the persisted resource reference.

## Tab restoration

Tabs persist ordered, structured resource references rather than URL strings.
The route builder derives the canonical URL from each reference. On reload, the
browser restores the ordered set and uses the current URL to select the active
resource. A deep-linked resource that is not already present is added once.
The Project Workbench is pinned and is not part of the resource array. The Theme
selector is a non-route popover and is not represented in the resource array.
Local view state such as a Session draft or Markdown mode is retained while the
React Activity remains mounted, but it is not copied into persistent tab data.
The supporting file selected inside a Skill follows the same rule and resets to
`SKILL.md` after a full page reload.

A File reference contains Project Name, Workspace ID, and Project-relative
path. The same path in two Workspaces therefore opens two distinct tabs. The
Workspace ID remains bound to the tab even when the Files browser selects a
different directory.

The browser stores one last canonical path for each of Projects, Agents, and
Skills, plus the last selected Activity. The current URL wins on reload and
updates this navigation memory. Switching Activities navigates to the saved path
for the destination, so returning to Projects restores the exact collection or
detail route. Opening Theme does not overwrite Activity navigation memory.
Only canonical pathnames are stored; query strings, hashes, search terms,
scroll positions, and copied resource content are not persisted.

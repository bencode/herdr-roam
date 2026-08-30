# Project Registry and Routing

## Project identity

Roam identifies a project by a unique, stable, human-readable Project Name.
The name is both the browser/server lookup key and the value used in URLs. A
Project Name uses lowercase letters, numbers, `.`, `_`, and `-`. It is not a
display label derived on every startup and it does not receive a random suffix.

The future Roam server owns a versioned `config.json` in Roam's local
application configuration directory:

```json
{
  "version": 1,
  "projects": [
    {
      "name": "herdr-roam",
      "path": "/Users/bencode/work/herdr-roam"
    },
    {
      "name": "archive-herdr-roam",
      "path": "/Users/bencode/archive/herdr-roam"
    }
  ]
}
```

The array order is the default Project Selector order. Names are unique after
case normalization, and canonical absolute paths are unique. The server may
build a transient lookup map after validation, but it preserves the array in
the file. Moving a directory updates its path without changing its name.
Renaming a registered project is outside the first version.

The browser sends a Project Name for project operations. It never sends an
arbitrary absolute path to select a filesystem root. Runtime availability, Git
state, and other derived values are not stored in this minimal registry.

This milestone defines the contract and matching browser fixtures only. The
server-side configuration reader, writer, and Project API will be implemented
with the server foundation.

## Canonical routes

```text
/
/projects
/projects/:projectName
/projects/:projectName/sessions
/projects/:projectName/sessions/:sessionId
/projects/:projectName/issues
/projects/:projectName/issues/:issueId
/projects/:projectName/loops
/projects/:projectName/files
/projects/:projectName/files/:path...
/projects/:projectName/skills/:skillId
/agents
/agents/:agentId
/skills
/skills/:skillId
/settings/runtime
```

`/` restores the last global Activity and that Activity's last canonical path.
`/projects` restores the Projects Activity's last path. The collection routes
select the corresponding Activity or Project resource browser without inventing
a persisted content tab. A project resource route identifies the owner of the
resource; activating a cross-project resource does not silently change the
Project selected for browsing. Only opening a Project Workbench, opening a
Project collection route, or selecting a Project changes the active Project.

The Activity is normally derived from the resource type. Project Sessions,
Issues, Loops, and Files belong to Projects; Agents belong to Agents; and both
user and project Skills belong to Skills. Consequently,
`/projects/:projectName/skills/:skillId` selects the Skills Activity despite its
project-scoped canonical path.

Each path segment is URI encoded independently. The old
`/projects/:projectName/workbench` form is not a compatibility route because
the application is still pre-release.

## Tab restoration

Tabs persist ordered, structured resource references rather than URL strings.
The route builder derives the canonical URL from each reference. On reload, the
browser restores the ordered set and uses the current URL to select the active
resource. A deep-linked resource that is not already present is added once.

The Project Workbench is pinned and is not part of the resource array. Runtime
Settings is a route-backed temporary utility tab and is also not persisted.
Local view state such as a Session draft or Markdown mode is retained while the
React Activity remains mounted, but it is not copied into persistent tab data.

The browser stores one last canonical path for each of Projects, Agents, and
Skills, plus the last selected Activity. The current URL wins on reload and
updates this navigation memory. Switching Activities navigates to the saved path
for the destination, so returning to Projects restores the exact collection or
detail route. Runtime Settings does not overwrite Activity navigation memory.
Only canonical pathnames are stored; query strings, hashes, search terms, scroll
positions, and copied resource content are not persisted.

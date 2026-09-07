# Project Files

## Source and catalog

Files are read directly from a selected Project Workspace. A Workspace is a
real directory: an existing Git worktree or the primary directory of a non-Git
Project. Roam stores no file index, copied content, Workspace catalog, cache, or
database records.

For a Git worktree, the catalog is the union returned by:

```sh
git ls-files --cached --others --exclude-standard
```

This includes tracked files and unignored untracked files. In a non-Git
directory, Roam walks the filesystem and excludes dependency and generated
directories such as `.git`, `node_modules`, `dist`, `build`, and `coverage`.
Fallback search stops after 100,000 entries rather than consuming unbounded
resources.

Directory reads and path searches return at most 200 entries per request with
an opaque cursor. Expanding a directory reads only that directory. Search is
performed by the server against the current source catalog; the browser does
not download the whole tree.

## Read boundary

Every API path is Workspace-relative. The client sends an opaque Workspace ID;
the server resolves it against the Project's currently available worktrees and
never accepts a client-selected absolute root. It then canonicalizes the
requested entry, rejects absolute paths and `..`, and verifies that symbolic
links do not leave the selected Workspace.

```text
GET /api/projects/:projectName/workspaces
GET /api/projects/:projectName/workspaces/:workspaceId/files
GET /api/projects/:projectName/workspaces/:workspaceId/files/search?query=...
GET /api/projects/:projectName/workspaces/:workspaceId/files/view?path=...
GET /api/projects/:projectName/workspaces/:workspaceId/files/raw/:path
```

Text previews are limited to 1 MiB. Image and allowlisted raw assets are
limited to 20 MiB. Raw image content is signature-checked; arbitrary files are
not exposed through the asset endpoint. SVG responses receive a restrictive
Content Security Policy and all raw responses disable content sniffing and
caching.

## Browser readers

Opening a file creates or reuses its ordinary Workbench resource tab at
`/projects/:projectName/files/:workspaceId/:path`. Collection routes open only
the Files browser. Tabs retain references, not file content, and an explicit
refresh re-reads the source file.

When a Project has multiple Workspaces, Files shows a compact directory
selector above search. It displays the directory name first, current branch as
secondary metadata, and the full path in the open menu. The choice affects only
the Files tree and is remembered per Project in browser storage. It does not
change Agent or Session directories, and it does not retarget existing File
tabs. If a selected Workspace disappears, Files falls back to the primary
Workspace while an already-open tab retains its failed reference and reports
that the directory is unavailable.

Markdown, source, HTML, images, binary files, and oversized files use separate
read-only presentations. HTML preview runs in a sandboxed iframe without script
permission. Relative Markdown links open another file tab, while relative
images use the bounded raw endpoint.

The common Markdown renderer handles ordinary GFM synchronously. Formula,
Mermaid, full file readers, and syntax-highlighting code are split into
on-demand browser chunks, so common Session and Skill prose does not
load uncommon rendering engines.

Editing, deleting, watching, arbitrary branch snapshots, Git checkout,
worktree management, Git status, PDF rendering, annotations, and download
management are outside this slice.

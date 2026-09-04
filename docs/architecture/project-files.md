# Project Files

## Source and catalog

Files are read directly from each registered Project root. Roam stores no file
index, copied content, cache, or database records.

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

Every API path is Project-relative. The server canonicalizes the registered
root and requested entry, rejects absolute paths and `..`, and verifies that
symbolic links do not leave the root.

```text
GET /api/projects/:projectName/files
GET /api/projects/:projectName/files/search?query=...
GET /api/projects/:projectName/files/view?path=...
GET /api/projects/:projectName/files/raw/:path
```

Text previews are limited to 1 MiB. Image and allowlisted raw assets are
limited to 20 MiB. Raw image content is signature-checked; arbitrary files are
not exposed through the asset endpoint. SVG responses receive a restrictive
Content Security Policy and all raw responses disable content sniffing and
caching.

## Browser readers

Opening a file creates or reuses its ordinary Workbench resource tab at
`/projects/:projectName/files/:path`. Collection routes open only the Files
browser. Tabs retain references, not file content, and an explicit refresh
re-reads the source file.

Markdown, source, HTML, images, binary files, and oversized files use separate
read-only presentations. HTML preview runs in a sandboxed iframe without script
permission. Relative Markdown links open another file tab, while relative
images use the bounded raw endpoint.

The common Markdown renderer handles ordinary GFM synchronously. Formula,
Mermaid, full file readers, and syntax-highlighting code are split into
on-demand browser chunks, so common Session, Issue, and Skill prose does not
load uncommon rendering engines.

Editing, deleting, watching, Git status, PDF rendering, annotations, and
download management are outside this slice.

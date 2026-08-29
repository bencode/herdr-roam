import type { Agent, FileResource, Issue, Loop, Project, Session } from './data'

export const projects: readonly Project[] = [
  {
    name: 'herdr-roam',
    path: '/work/herdr-roam',
    issuesConfigured: true,
  },
  {
    name: 'cc-mission-control',
    path: '/work/cc-mission-control',
    issuesConfigured: false,
  },
  {
    name: 'archive-herdr-roam',
    path: '/archive/herdr-roam',
    issuesConfigured: false,
  },
]

const visionFile = {
  type: 'file' as const,
  projectName: 'herdr-roam',
  path: 'docs/product/vision-and-scope.md',
}

const session = (
  id: string,
  title: string,
  provider: Session['provider'],
  status: Session['status'],
  updated: string,
  projectName = 'herdr-roam',
): Session => ({
  id,
  title,
  provider,
  status,
  updated,
  projectName,
  messages: [
    {
      id: `${id}-user-1`,
      author: 'You',
      body: `Review ${title.toLowerCase()} and leave a concrete result for the project.`,
    },
    {
      id: `${id}-agent-1`,
      author: provider,
      body: `${title} has been reviewed. The current fixture keeps the conversation readable while the project layout is exercised with realistic data density.`,
    },
  ],
})

export const sessions: readonly Session[] = [
  {
    ...session('product-scan', 'Product scan', 'Codex', 'working', 'now'),
    artifact: visionFile,
  },
  session('api-review', 'API review', 'Claude', 'blocked', '12m'),
  session('runtime-design', 'Runtime design', 'Codex', 'done', '1h'),
  session('security-review', 'Local security boundary review', 'Claude', 'working', '1h'),
  session('issue-schema', 'Issue front matter compatibility', 'Codex', 'idle', '2h'),
  session('session-discovery', 'Codex and Claude session discovery', 'Claude', 'done', '3h'),
  session('file-tree-audit', 'Large repository file tree audit', 'Codex', 'working', '4h'),
  session('loop-scheduler', 'Loop scheduler failure semantics', 'Claude', 'blocked', '5h'),
  session('attach-protocol', 'Browser attach ownership protocol', 'Codex', 'idle', 'yesterday'),
  session('dark-theme-check', 'Dark theme accessibility check', 'Claude', 'done', 'yesterday'),
  session('release-notes', 'Prepare the first public release notes', 'Codex', 'done', '2d'),
  session('test-stability', 'Stabilize workbench interaction tests', 'Claude', 'done', '3d'),
  session('provider-parity', 'Provider capability parity matrix', 'Codex', 'idle', '4d'),
  session('docs-polish', 'Product documentation consistency pass', 'Claude', 'done', '6d'),
  session('mission-review', 'Mission board review', 'Claude', 'idle', '2h', 'cc-mission-control'),
  session('archive-notes', 'Archive migration notes', 'Codex', 'done', '8d', 'cc-mission-control'),
]

export const agents: readonly Agent[] = [
  {
    id: 'agent-product-scan',
    name: 'codex-product',
    provider: 'Codex',
    projectName: 'herdr-roam',
    status: 'working',
    sessionId: 'product-scan',
  },
  {
    id: 'agent-api-review',
    name: 'claude-api',
    provider: 'Claude',
    projectName: 'herdr-roam',
    status: 'blocked',
    sessionId: 'api-review',
  },
  {
    id: 'agent-file-tree',
    name: 'codex-files',
    provider: 'Codex',
    projectName: 'herdr-roam',
    status: 'working',
    sessionId: 'file-tree-audit',
  },
  {
    id: 'agent-mission-review',
    name: 'claude-mission',
    provider: 'Claude',
    projectName: 'cc-mission-control',
    status: 'idle',
    sessionId: 'mission-review',
  },
]

type IssueSpec = readonly [
  id: string,
  title: string,
  status: Issue['status'],
  stage: string,
  labels: readonly string[],
  sessionId: string,
  filePath: string,
]

const issueSpecs: readonly IssueSpec[] = [
  [
    'hr-018',
    'Clarify runtime ownership',
    'open',
    'Product review',
    ['runtime', 'coordination'],
    'product-scan',
    'docs/design/workbench-interactions.md',
  ],
  [
    'hr-017',
    'Define session history fallback behavior',
    'open',
    'Ready',
    ['sessions', 'providers'],
    'session-discovery',
    'docs/product/vision-and-scope.md',
  ],
  [
    'hr-016',
    'Keep attach ownership explicit across clients',
    'open',
    'In progress',
    ['runtime', 'terminal'],
    'attach-protocol',
    'docs/design/workbench-interactions.md',
  ],
  [
    'hr-015',
    'Describe oversized file handling in the reader',
    'open',
    'Discovered',
    ['files', 'reader'],
    'file-tree-audit',
    'docs/product/vision-and-scope.md',
  ],
  [
    'hr-014',
    'Separate user and project Skill discovery',
    'open',
    'Ready',
    ['skills'],
    'product-scan',
    'docs/product/vision-and-scope.md',
  ],
  [
    'hr-013',
    'Audit dark mode contrast for muted metadata',
    'open',
    'Review',
    ['accessibility', 'theme'],
    'dark-theme-check',
    'ui-packages/web/src/app.tsx',
  ],
  [
    'hr-012',
    'Document Loop error and retry semantics',
    'open',
    'Discovered',
    ['loops', 'runtime'],
    'loop-scheduler',
    'docs/design/workbench-interactions.md',
  ],
  [
    'hr-011',
    'Preserve drafts when closing active work',
    'open',
    'Product review',
    ['sessions', 'safety'],
    'test-stability',
    'docs/design/workbench-interactions.md',
  ],
  [
    'hr-010',
    'Clarify provider capability differences',
    'closed',
    'Done',
    ['providers'],
    'provider-parity',
    'docs/product/vision-and-scope.md',
  ],
  [
    'hr-009',
    'Define Git-backed issue front matter',
    'closed',
    'Done',
    ['issues', 'git'],
    'issue-schema',
    'docs/product/vision-and-scope.md',
  ],
  [
    'hr-008',
    'Remove inactive milestone controls',
    'closed',
    'Done',
    ['interface'],
    'docs-polish',
    'docs/design/workbench-interactions.md',
  ],
  [
    'hr-007',
    'Record local filesystem security boundary',
    'closed',
    'Done',
    ['security', 'files'],
    'security-review',
    'docs/architecture/system-overview.md',
  ],
]

export const issues: readonly Issue[] = issueSpecs.map(
  ([id, title, status, stage, labels, sessionId, filePath]) => ({
    id,
    title,
    status,
    stage,
    labels,
    sessionId,
    filePath,
    projectName: 'herdr-roam',
    body: `## Problem\n\n${title} needs a concrete, reviewable product decision.\n\n## Acceptance\n\n- The decision is visible in Roam.\n- Agents can consume the result without reconstructing context.`,
  }),
)

export const loops: readonly Loop[] = [
  {
    id: 'product-exploration',
    title: 'Product exploration',
    projectName: 'herdr-roam',
    status: 'enabled',
    schedule: 'Every day at 09:00',
    nextRun: 'tomorrow 09:00',
  },
  {
    id: 'ready-issue-producer',
    title: 'Ready issue producer',
    projectName: 'herdr-roam',
    status: 'paused',
    schedule: 'Every 4 hours',
    nextRun: 'paused',
  },
  {
    id: 'nightly-test-audit',
    title: 'Nightly test failure audit',
    projectName: 'herdr-roam',
    status: 'enabled',
    schedule: 'Weekdays at 23:30',
    nextRun: 'today 23:30',
  },
  {
    id: 'dependency-review',
    title: 'Dependency release review',
    projectName: 'herdr-roam',
    status: 'error',
    schedule: 'Monday at 10:00',
    nextRun: 'retry required',
  },
  {
    id: 'security-scan',
    title: 'Local security boundary scan',
    projectName: 'herdr-roam',
    status: 'enabled',
    schedule: 'Friday at 16:00',
    nextRun: 'Friday 16:00',
  },
  {
    id: 'docs-consistency',
    title: 'Documentation consistency pass',
    projectName: 'herdr-roam',
    status: 'paused',
    schedule: 'Every 2 days',
    nextRun: 'paused',
  },
  {
    id: 'provider-parity',
    title: 'Codex and Claude parity review',
    projectName: 'herdr-roam',
    status: 'enabled',
    schedule: 'First day of month',
    nextRun: 'Sep 1',
  },
  {
    id: 'stale-session-review',
    title: 'Stale Session review and follow-up',
    projectName: 'herdr-roam',
    status: 'error',
    schedule: 'Every Sunday',
    nextRun: 'configuration error',
  },
]

const featuredContent: Readonly<Record<string, string>> = {
  'docs/product/vision-and-scope.md':
    '# Vision and Scope\n\nHerdr Roam is a local personal AI software studio for coordinating multiple coding agents managed by one Herdr server.',
  'docs/design/workbench-interactions.md':
    '# Workbench Interactions\n\nThe application shell uses a contextual sidebar and one tabbed work area.',
  'docs/architecture/system-overview.md':
    '# System Overview\n\nHerdr owns runtime processes while Roam owns the coordination and reading layer.',
}

const file = (projectName: string, path: string): FileResource => {
  const language = path.endsWith('.md') ? 'markdown' : 'typescript'
  const name = path.split('/').at(-1) ?? path
  return {
    projectName,
    path,
    language,
    content:
      featuredContent[path] ??
      (language === 'markdown'
        ? `# ${name.replace('.md', '')}\n\nRepresentative project fixture for ${path}.`
        : `export const fixturePath = '${path}'\n`),
  }
}

const roamFilePaths = [
  'README.md',
  'AGENTS.md',
  'docs/product/vision-and-scope.md',
  'docs/product/runtime-model.md',
  'docs/product/issue-format.md',
  'docs/design/workbench-interactions.md',
  'docs/architecture/system-overview.md',
  'docs/research/herdr-api.md',
  'docs/research/session-discovery.md',
  'ui-packages/web/src/app.tsx',
  'ui-packages/web/src/main.tsx',
  'ui-packages/web/src/shell/app-shell/index.tsx',
  'ui-packages/web/src/shell/context-sidebar/index.tsx',
  'ui-packages/web/src/shell/context-sidebar/project-panel/index.tsx',
  'ui-packages/web/src/shell/tab-bar/index.tsx',
  'ui-packages/web/src/features/session/session-tab/index.tsx',
  'ui-packages/web/src/features/issue/issue-tab/index.tsx',
  'ui-packages/web/src/features/file/file-tab/index.tsx',
  'ui-packages/web/src/features/workbench/workbench-home/index.tsx',
  'ui-packages/web/src/workbench/resource.ts',
  'ui-packages/web/src/workbench/resource-route.ts',
  'ui-packages/web/src/workbench/store.ts',
  'ui-packages/web/src/mock/data.ts',
  'ui-packages/web/src/mock/project-data.ts',
] as const

const missionFilePaths = [
  'README.md',
  'AGENTS.md',
  'docs/architecture.md',
  'src/mission-board.tsx',
  'src/session-store.ts',
] as const

export const files: readonly FileResource[] = [
  ...roamFilePaths.map(path => file('herdr-roam', path)),
  ...missionFilePaths.map(path => file('cc-mission-control', path)),
]

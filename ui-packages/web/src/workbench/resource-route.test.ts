import {
  activityRootPath,
  canonicalPath,
  parseResourcePath,
  projectPath,
  projectSectionPath,
  resourcePath,
  routeDimension,
  routeProjectSection,
} from './resource-route'

describe('resource routes', () => {
  it('round-trips project resources and encoded file paths', () => {
    const file = {
      type: 'file',
      projectName: 'roam project',
      workspaceId: 'workspace id',
      path: 'docs/产品 plan.md',
    } as const
    expect(parseResourcePath(resourcePath(file))).toEqual({ kind: 'resource', resource: file })
    expect(projectPath('roam project')).toBe('/projects/roam%20project')
    expect(projectSectionPath('roam project', 'files')).toBe('/projects/roam%20project/files')
    expect(activityRootPath('agents', 'roam project')).toBe('/agents')
  })

  it('parses project collection and detail routes', () => {
    expect(parseResourcePath('/projects')).toEqual({ kind: 'projects' })
    expect(parseResourcePath('/projects/herdr-roam')).toEqual({
      kind: 'workbench',
      projectName: 'herdr-roam',
    })
    expect(parseResourcePath('/projects/herdr-roam/sessions/codex/product-scan')).toEqual({
      kind: 'resource',
      resource: {
        type: 'session',
        projectName: 'herdr-roam',
        provider: 'codex',
        sessionId: 'product-scan',
      },
    })
    expect(parseResourcePath('/projects/herdr-roam/files')).toEqual({
      kind: 'project-section',
      projectName: 'herdr-roam',
      section: 'files',
    })
    expect(parseResourcePath('/skills/agents%3Afrontend-api-docs')).toEqual({
      kind: 'resource',
      resource: { type: 'skill', scope: 'user', skillId: 'agents:frontend-api-docs' },
    })
    const projectSkill = {
      type: 'skill',
      scope: 'project',
      projectName: 'herdr-roam',
      skillId: 'codex:frontend-design',
    } as const
    expect(parseResourcePath(resourcePath(projectSkill))).toEqual({
      kind: 'resource',
      resource: projectSkill,
    })
  })

  it('round-trips an independent Agent route', () => {
    const agent = { type: 'agent', agentId: 'terminal:id/with spaces' } as const
    expect(resourcePath(agent)).toBe('/agents/terminal%3Aid%2Fwith%20spaces')
    expect(parseResourcePath(resourcePath(agent))).toEqual({ kind: 'resource', resource: agent })
  })

  it('maps collection and resource routes to their owning Activity', () => {
    expect(parseResourcePath('/agents')).toEqual({ kind: 'agent-list' })
    expect(parseResourcePath('/skills')).toEqual({ kind: 'skill-list' })
    expect(routeDimension(parseResourcePath('/agents/codex'))).toBe('agents')
    expect(routeDimension(parseResourcePath('/skills/agents%3Afrontend-design'))).toBe('skills')
    expect(
      routeDimension(parseResourcePath('/projects/herdr-roam/skills/codex%3Afrontend-design')),
    ).toBe('skills')
    const target = parseResourcePath('/projects/herdr-roam/files/primary/docs/guide.md')
    expect(routeDimension(target)).toBe('projects')
    expect(routeProjectSection(target)).toBe('files')
    expect(canonicalPath(target)).toBe('/projects/herdr-roam/files/primary/docs/guide.md')
  })

  it('returns unknown for unsupported and legacy routes', () => {
    expect(parseResourcePath('/projects/herdr-roam/workbench')).toEqual({ kind: 'unknown' })
    expect(parseResourcePath('/projects/herdr-roam/loops')).toEqual({ kind: 'unknown' })
    expect(parseResourcePath('/projects/herdr-roam/issues')).toEqual({ kind: 'unknown' })
    expect(
      parseResourcePath(
        '/projects/herdr-roam/issues/primary/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      ),
    ).toEqual({ kind: 'unknown' })
    expect(parseResourcePath('/projects/herdr-roam/issues/hr-018')).toEqual({ kind: 'unknown' })
    expect(parseResourcePath('/projects/herdr-roam/loops/not-supported')).toEqual({
      kind: 'unknown',
    })
    expect(parseResourcePath('/unrelated')).toEqual({ kind: 'unknown' })
    expect(parseResourcePath('/settings/runtime')).toEqual({ kind: 'unknown' })
  })
})

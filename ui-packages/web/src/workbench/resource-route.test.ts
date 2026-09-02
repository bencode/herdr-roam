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
      path: 'docs/产品 plan.md',
    } as const
    expect(parseResourcePath(resourcePath(file))).toEqual({ kind: 'resource', resource: file })
    expect(projectPath('roam project')).toBe('/projects/roam%20project')
    expect(projectSectionPath('roam project', 'issues')).toBe('/projects/roam%20project/issues')
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
    expect(parseResourcePath('/projects/herdr-roam/issues')).toEqual({
      kind: 'project-section',
      projectName: 'herdr-roam',
      section: 'issues',
    })
    expect(parseResourcePath('/projects/herdr-roam/loops')).toEqual({
      kind: 'project-section',
      projectName: 'herdr-roam',
      section: 'loops',
    })
    expect(parseResourcePath('/projects/herdr-roam/files')).toEqual({
      kind: 'project-section',
      projectName: 'herdr-roam',
      section: 'files',
    })
    expect(parseResourcePath('/projects/herdr-roam/issues/hr-018').kind).toBe('resource')
    expect(parseResourcePath('/skills/herdr-roam-issues')).toEqual({
      kind: 'resource',
      resource: { type: 'skill', scope: 'user', skillId: 'herdr-roam-issues' },
    })
    const projectSkill = {
      type: 'skill',
      scope: 'project',
      projectName: 'herdr-roam',
      skillId: 'frontend-design',
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
    expect(routeDimension(parseResourcePath('/skills/frontend-design'))).toBe('skills')
    expect(routeDimension(parseResourcePath('/projects/herdr-roam/skills/frontend-design'))).toBe(
      'skills',
    )
    expect(routeDimension(parseResourcePath('/projects/herdr-roam/issues/hr-018'))).toBe('projects')
    expect(routeProjectSection(parseResourcePath('/projects/herdr-roam/issues/hr-018'))).toBe(
      'issues',
    )
    const target = parseResourcePath('/projects/herdr-roam/files/docs/guide.md')
    expect(canonicalPath(target)).toBe('/projects/herdr-roam/files/docs/guide.md')
  })

  it('returns unknown for unsupported and legacy routes', () => {
    expect(parseResourcePath('/projects/herdr-roam/workbench')).toEqual({ kind: 'unknown' })
    expect(parseResourcePath('/projects/herdr-roam/loops/not-supported')).toEqual({
      kind: 'unknown',
    })
    expect(parseResourcePath('/unrelated')).toEqual({ kind: 'unknown' })
    expect(parseResourcePath('/settings/runtime')).toEqual({ kind: 'unknown' })
  })
})

import { parseResourcePath, projectPath, resourcePath, runtimePath } from './resource-route'

describe('resource routes', () => {
  it('round-trips project resources and encoded file paths', () => {
    const file = {
      type: 'file',
      projectName: 'roam project',
      path: 'docs/产品 plan.md',
    } as const
    expect(parseResourcePath(resourcePath(file))).toEqual({ kind: 'resource', resource: file })
    expect(projectPath('roam project')).toBe('/projects/roam%20project')
  })

  it('parses project, session, issue, and skill routes', () => {
    expect(parseResourcePath('/projects')).toEqual({ kind: 'projects' })
    expect(parseResourcePath('/projects/herdr-roam')).toEqual({
      kind: 'workbench',
      projectName: 'herdr-roam',
    })
    expect(parseResourcePath('/projects/herdr-roam/sessions/product-scan')).toEqual({
      kind: 'resource',
      resource: { type: 'session', projectName: 'herdr-roam', sessionId: 'product-scan' },
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

  it('parses Runtime settings as a utility route', () => {
    expect(runtimePath()).toBe('/settings/runtime')
    expect(parseResourcePath(runtimePath())).toEqual({ kind: 'utility', utility: 'runtime' })
  })

  it('returns unknown for unsupported and legacy routes', () => {
    expect(parseResourcePath('/projects/herdr-roam/files')).toEqual({ kind: 'unknown' })
    expect(parseResourcePath('/projects/herdr-roam/workbench')).toEqual({ kind: 'unknown' })
    expect(parseResourcePath('/unrelated')).toEqual({ kind: 'unknown' })
  })
})

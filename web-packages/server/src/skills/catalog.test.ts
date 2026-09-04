import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { SkillSource } from '@herdr-roam/shared'
import { afterEach, describe, expect, it } from 'vitest'
import { listSkills, readSkillDetail } from './catalog.js'
import { personalRoots, projectRoots } from './identity.js'

const directories: string[] = []

const temporary = async (name: string): Promise<string> => {
  const path = await mkdtemp(join(tmpdir(), `herdr-roam-${name}-`))
  directories.push(path)
  return path
}

const roots = async (): Promise<Readonly<Record<SkillSource, string>>> => {
  const root = await temporary('skill-catalog')
  return {
    agents: join(root, '.agents', 'skills'),
    codex: join(root, '.codex', 'skills'),
    claude: join(root, '.claude', 'skills'),
  }
}

const writeSkill = async (root: string, name: string, document: string): Promise<void> => {
  const directory = join(root, name)
  await mkdir(directory, { recursive: true })
  await writeFile(join(directory, 'SKILL.md'), document)
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

describe('Skill catalog', () => {
  it('keeps same-name Skills from each source and separates Project scope', async () => {
    const user = await roots()
    const project = await temporary('skill-project')
    await writeSkill(user.agents, 'shared', '---\nname: Shared\ndescription: Agents copy\n---\n')
    await writeSkill(user.claude, 'shared', '# Shared\n\nClaude fallback description.')
    await writeSkill(join(project, '.codex', 'skills'), 'project-only', '# Project\n')

    const catalog = await listSkills([...personalRoots(user), ...projectRoots('fixture', project)])

    expect(catalog.items.map(skill => [skill.scope, skill.source, skill.name])).toEqual([
      ['project', 'codex', 'project-only'],
      ['user', 'agents', 'Shared'],
      ['user', 'claude', 'shared'],
    ])
    expect(catalog.items.at(-1)?.description).toBe('Claude fallback description.')
    expect(catalog.warnings).toEqual([])
  })

  it('accepts a linked Skill root and reports invalid or broken Skills', async () => {
    const user = await roots()
    const external = await temporary('linked-skill')
    await writeFile(join(external, 'SKILL.md'), '# Linked\n\nExternal but trusted root.')
    await mkdir(user.codex, { recursive: true })
    await symlink(external, join(user.codex, 'linked'))
    await writeSkill(user.codex, 'invalid', '---\nname: [\n---\n')
    await symlink(join(external, 'missing'), join(user.codex, 'broken'))

    const catalog = await listSkills(personalRoots(user))
    const detail = await readSkillDetail(personalRoots(user), 'codex:linked')

    expect(catalog.items.map(skill => skill.id)).toEqual(['codex:linked'])
    expect(catalog.warnings).toHaveLength(2)
    expect(catalog.warnings.map(warning => warning.code).sort()).toEqual([
      'invalid_skill',
      'skill_unavailable',
    ])
    expect(detail.document).toMatchObject({ kind: 'markdown', path: 'SKILL.md' })
  })
})

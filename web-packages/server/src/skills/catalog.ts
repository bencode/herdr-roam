import { readdir, readFile } from 'node:fs/promises'
import type {
  SkillCatalog,
  SkillCatalogWarning,
  SkillDetail,
  SkillSource,
  SkillSummary,
} from '@herdr-roam/shared'
import { parse } from 'yaml'
import { PROJECT_TEXT_MAX_BYTES, readResolvedFile } from '../files/content.js'
import {
  parseSkillId,
  resolveSkillDirectory,
  resolveSkillEntry,
  rootForIdentity,
  SkillError,
  skillId,
  type SkillRoot,
} from './identity.js'

type Frontmatter = {
  readonly name?: string
  readonly description?: string
}

type InspectedSkill = {
  readonly summary: SkillSummary
  readonly root: string
}

const sourceOrder: Readonly<Record<SkillSource, number>> = {
  agents: 0,
  codex: 1,
  claude: 2,
}

const systemCode = (error: unknown): unknown =>
  typeof error === 'object' && error !== null && 'code' in error ? error.code : null

const recordOf = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null

const firstParagraph = (body: string): string =>
  body
    .split(/\r?\n\s*\r?\n/)
    .map(value => value.trim())
    .find(value => value !== '' && !value.startsWith('#') && !value.startsWith('```'))
    ?.replace(/\s+/g, ' ')
    .slice(0, 280) ?? ''

const parseDocument = (content: string): { readonly data: Frontmatter; readonly body: string } => {
  if (!content.startsWith('---\n') && !content.startsWith('---\r\n')) {
    return { data: {}, body: content }
  }
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content)
  if (!match) throw new SkillError('invalid_skill', 'SKILL.md frontmatter is not terminated.')
  let parsed: unknown
  try {
    parsed = parse(match[1] ?? '')
  } catch (error) {
    throw new SkillError('invalid_skill', 'SKILL.md frontmatter is not valid YAML.', {
      cause: error,
    })
  }
  const record = parsed === null ? {} : recordOf(parsed)
  if (!record) throw new SkillError('invalid_skill', 'SKILL.md frontmatter must be an object.')
  const name = record.name
  const description = record.description
  if (name !== undefined && (typeof name !== 'string' || name.trim() === '')) {
    throw new SkillError('invalid_skill', 'SKILL.md name must be a non-empty string.')
  }
  if (description !== undefined && (typeof description !== 'string' || description.trim() === '')) {
    throw new SkillError('invalid_skill', 'SKILL.md description must be a non-empty string.')
  }
  return {
    data: {
      ...(typeof name === 'string' ? { name: name.trim() } : {}),
      ...(typeof description === 'string' ? { description: description.trim() } : {}),
    },
    body: content.slice(match[0].length),
  }
}

const inspectSkill = async (root: SkillRoot, folderName: string): Promise<InspectedSkill> => {
  const directory = await resolveSkillDirectory(root, folderName)
  let content: string
  try {
    const document = await resolveSkillEntry(directory, 'SKILL.md')
    if (!document.stats.isFile()) throw new SkillError('invalid_skill', 'SKILL.md is not a file.')
    if (document.stats.size > PROJECT_TEXT_MAX_BYTES) {
      throw new SkillError('invalid_skill', 'SKILL.md exceeds the 1 MiB reading limit.')
    }
    content = await readFile(document.path, 'utf8')
  } catch (error) {
    if (error instanceof SkillError) throw error
    if (systemCode(error) === 'ENOENT' || systemCode(error) === 'ENOTDIR') {
      throw new SkillError('invalid_skill', 'Skill directory does not contain SKILL.md.', {
        cause: error,
      })
    }
    throw new SkillError('skill_unavailable', 'SKILL.md could not be read.', { cause: error })
  }
  const document = parseDocument(content)
  return {
    root: directory,
    summary: {
      id: skillId(root.source, folderName),
      name: document.data.name ?? folderName,
      description: document.data.description ?? firstParagraph(document.body),
      source: root.source,
      scope: root.scope,
      ...(root.projectName ? { projectName: root.projectName } : {}),
      location: `${root.displayPath}/${folderName}`,
    },
  }
}

const rootSkills = async (
  root: SkillRoot,
): Promise<{
  readonly items: readonly SkillSummary[]
  readonly warnings: readonly SkillCatalogWarning[]
}> => {
  let names: readonly string[]
  try {
    names = (await readdir(root.path, { withFileTypes: true }))
      .filter(entry => entry.name !== '.system' && (entry.isDirectory() || entry.isSymbolicLink()))
      .map(entry => entry.name)
  } catch (error) {
    if (systemCode(error) === 'ENOENT' || systemCode(error) === 'ENOTDIR') {
      return { items: [], warnings: [] }
    }
    return {
      items: [],
      warnings: [
        {
          scope: root.scope,
          source: root.source,
          location: root.displayPath,
          code: 'skill_unavailable',
          message: 'Skill source directory could not be read.',
        },
      ],
    }
  }
  const inspected = await Promise.all(
    names.map(async folderName => {
      try {
        return { skill: await inspectSkill(root, folderName), warning: null }
      } catch (error) {
        const invalid = error instanceof SkillError && error.code === 'invalid_skill'
        return {
          skill: null,
          warning: {
            scope: root.scope,
            source: root.source,
            location: `${root.displayPath}/${folderName}`,
            code: invalid ? ('invalid_skill' as const) : ('skill_unavailable' as const),
            message: error instanceof Error ? error.message : 'Skill could not be inspected.',
          },
        }
      }
    }),
  )
  return {
    items: inspected.flatMap(result => (result.skill ? [result.skill.summary] : [])),
    warnings: inspected.flatMap(result => (result.warning ? [result.warning] : [])),
  }
}

const compareSkills = (left: SkillSummary, right: SkillSummary): number =>
  (left.scope === right.scope ? 0 : left.scope === 'project' ? -1 : 1) ||
  left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }) ||
  sourceOrder[left.source] - sourceOrder[right.source]

export const listSkills = async (roots: readonly SkillRoot[]): Promise<SkillCatalog> => {
  const values = await Promise.all(roots.map(rootSkills))
  return {
    items: values.flatMap(value => value.items).toSorted(compareSkills),
    warnings: values.flatMap(value => value.warnings),
  }
}

export const resolveSkill = async (
  roots: readonly SkillRoot[],
  id: string,
): Promise<InspectedSkill> => {
  const identity = parseSkillId(id)
  return inspectSkill(rootForIdentity(roots, identity), identity.folderName)
}

export const readSkillDetail = async (
  roots: readonly SkillRoot[],
  id: string,
): Promise<SkillDetail> => {
  const skill = await resolveSkill(roots, id)
  const entry = await resolveSkillEntry(skill.root, 'SKILL.md')
  return { ...skill.summary, document: await readResolvedFile('SKILL.md', entry) }
}

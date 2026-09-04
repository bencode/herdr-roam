import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchSkillCatalog, fetchSkillDetail } from './client'

afterEach(() => vi.unstubAllGlobals())

describe('Skill client', () => {
  it('loads a source-qualified catalog and Project detail', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [
              {
                id: 'codex:frontend-design',
                name: 'frontend-design',
                description: 'Design interfaces.',
                source: 'codex',
                scope: 'project',
                projectName: 'fixture',
                location: '.codex/skills/frontend-design',
              },
            ],
            warnings: [],
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'codex:frontend-design',
            name: 'frontend-design',
            description: 'Design interfaces.',
            source: 'codex',
            scope: 'project',
            projectName: 'fixture',
            location: '.codex/skills/frontend-design',
            document: {
              kind: 'markdown',
              path: 'SKILL.md',
              name: 'SKILL.md',
              size: 10,
              modifiedAt: '2026-09-01T00:00:00.000Z',
              mediaType: 'text/markdown',
              language: 'markdown',
              content: '# Skill\n',
            },
          }),
        ),
      )
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchSkillCatalog('fixture')).resolves.toMatchObject({
      items: [{ id: 'codex:frontend-design' }],
    })
    await expect(
      fetchSkillDetail({
        type: 'skill',
        scope: 'project',
        projectName: 'fixture',
        skillId: 'codex:frontend-design',
      }),
    ).resolves.toMatchObject({ document: { kind: 'markdown' } })
    expect(fetchMock.mock.calls.map(call => call[0])).toEqual([
      '/api/skills?project=fixture',
      '/api/skills/project/codex%3Afrontend-design?project=fixture',
    ])
  })

  it('rejects malformed success responses observably', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [] }))))

    await expect(fetchSkillCatalog('')).rejects.toMatchObject({
      code: 'invalid_response',
    })
  })
})

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SkillTab } from '.'

const detailReload = vi.hoisted(() => vi.fn())
const fileReload = vi.hoisted(() => vi.fn())

vi.mock('../use-skill-detail', () => ({
  useSkillDetail: () => ({
    value: {
      id: 'agents:fixture',
      name: 'fixture',
      description: 'Fixture Skill.',
      source: 'agents' as const,
      scope: 'user' as const,
      location: '~/.agents/skills/fixture',
      document: {
        kind: 'markdown' as const,
        path: 'SKILL.md',
        name: 'SKILL.md',
        size: 10,
        modifiedAt: '2026-09-01T00:00:00.000Z',
        mediaType: 'text/markdown',
        language: 'markdown',
        content: '# Fixture\n',
      },
    },
    loading: false,
    error: null,
    reload: detailReload,
  }),
  useSkillFile: (_resource: unknown, path: string | null) => ({
    value: path
      ? {
          kind: 'text' as const,
          path,
          name: path,
          size: 8,
          modifiedAt: '2026-09-01T00:00:00.000Z',
          mediaType: 'text/plain',
          language: 'text',
          content: 'support',
        }
      : null,
    loading: false,
    error: null,
    reload: fileReload,
  }),
}))

vi.mock('../use-skill-files', () => ({
  useSkillFiles: (_resource: unknown, directory: string) => ({
    items:
      directory === ''
        ? [{ kind: 'file' as const, name: 'guide.md', path: 'references/guide.md' }]
        : [],
    total: directory === '' ? 1 : 0,
    nextCursor: null,
    loading: false,
    error: null,
    loadMore: vi.fn(),
    retry: vi.fn(),
  }),
}))

vi.mock('../../../components/reader', () => ({
  FileReader: ({ file }: { readonly file: { readonly path: string } }) => (
    <output data-testid="skill-reader">{file.path}</output>
  ),
}))

describe('SkillTab', () => {
  it('opens supporting files inside the same Skill surface and refreshes all content', () => {
    render(<SkillTab resource={{ type: 'skill', scope: 'user', skillId: 'agents:fixture' }} />)

    expect(screen.getByTestId('skill-reader')).toHaveTextContent('SKILL.md')
    fireEvent.click(screen.getByRole('button', { name: 'guide.md' }))
    expect(screen.getByTestId('skill-reader')).toHaveTextContent('references/guide.md')
    fireEvent.click(screen.getByRole('button', { name: 'Overview' }))
    expect(screen.getByTestId('skill-reader')).toHaveTextContent('SKILL.md')
    fireEvent.click(screen.getByRole('button', { name: 'Refresh Skill' }))
    expect(detailReload).toHaveBeenCalled()
  })
})

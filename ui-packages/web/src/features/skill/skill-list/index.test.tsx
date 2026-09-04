import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SkillList } from '.'

const reload = vi.hoisted(() => vi.fn())

vi.mock('../use-skill-catalog', () => ({
  useSkillCatalog: () => ({
    value: {
      items: [
        {
          id: 'codex:shared',
          name: 'shared',
          description: 'Project copy',
          source: 'codex' as const,
          scope: 'project' as const,
          projectName: 'fixture',
          location: '.codex/skills/shared',
        },
        {
          id: 'claude:shared',
          name: 'shared',
          description: 'Personal copy',
          source: 'claude' as const,
          scope: 'user' as const,
          location: '~/.claude/skills/shared',
        },
      ],
      warnings: [
        {
          scope: 'project' as const,
          source: 'agents' as const,
          location: '.agents/skills/broken',
          code: 'skill_unavailable' as const,
          message: 'Skill directory was not found.',
        },
      ],
    },
    loading: false,
    error: null,
    reload,
  }),
}))

describe('SkillList', () => {
  it('groups duplicate names by scope, exposes sources, and tracks route selection', () => {
    const onOpen = vi.fn()
    render(
      <SkillList
        projectName="fixture"
        active={{ type: 'skill', scope: 'user', skillId: 'claude:shared' }}
        onOpen={onOpen}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Project · fixture' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Personal' })).toBeVisible()
    expect(screen.getAllByText('shared')).toHaveLength(2)
    expect(screen.getByRole('button', { name: /Personal copyClaude/ })).toHaveAttribute(
      'data-active',
    )
    fireEvent.click(screen.getByRole('button', { name: /Project copyCodex/ }))
    expect(onOpen).toHaveBeenCalledWith({
      type: 'skill',
      scope: 'project',
      projectName: 'fixture',
      skillId: 'codex:shared',
    })
  })

  it('filters both groups and exposes refresh and discovery warnings', () => {
    render(<SkillList projectName="fixture" active={null} onOpen={vi.fn()} />)

    fireEvent.change(screen.getByRole('textbox', { name: 'Search skills' }), {
      target: { value: 'personal' },
    })
    expect(screen.queryByRole('button', { name: /Project copy/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Personal copy/ })).toBeVisible()
    expect(screen.getByText('1 Skills unavailable')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Refresh Skills' }))
    expect(reload).toHaveBeenCalled()
  })
})

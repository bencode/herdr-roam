import type { CompareBranches } from '@herdr-roam/shared'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { BranchSelect } from './branch-select'

const catalog: CompareBranches = {
  defaultTargetRef: 'refs/remotes/origin/main',
  items: [
    { ref: 'refs/heads/main', name: 'main', oid: 'a'.repeat(40) },
    { ref: 'refs/heads/feature/topic', name: 'feature/topic', oid: 'b'.repeat(40) },
    { ref: 'refs/remotes/origin/main', name: 'origin/main', oid: 'c'.repeat(40) },
    { ref: 'refs/remotes/upstream/dev', name: 'upstream/dev', oid: 'd'.repeat(40) },
  ],
}

it('groups branches, searches names, and preserves full ref identity after refresh', async () => {
  const onChange = vi.fn()
  const view = render(
    <BranchSelect
      label="Source branch"
      value="refs/heads/main"
      catalog={catalog}
      onChange={onChange}
    />,
  )
  fireEvent.click(screen.getByRole('combobox', { name: 'Source branch' }))
  const search = await screen.findByRole('combobox', { name: 'Search source branch' })
  expect(screen.getByRole('group', { name: 'Local branches' })).toBeVisible()
  expect(screen.getByRole('group', { name: 'Remote branches' })).toBeVisible()
  expect(screen.getByRole('option', { name: 'main' })).toHaveAttribute('aria-selected', 'true')
  fireEvent.change(search, { target: { value: 'origin/' } })
  expect(await screen.findByRole('option', { name: 'origin/main' })).toBeVisible()
  expect(screen.queryByRole('option', { name: 'main' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('option', { name: 'origin/main' }))
  expect(onChange).toHaveBeenCalledWith('refs/remotes/origin/main')
  view.rerender(
    <BranchSelect
      label="Source branch"
      value="refs/remotes/origin/main"
      catalog={{
        ...catalog,
        items: catalog.items.map(branch => ({ ...branch, oid: 'e'.repeat(40) })),
      }}
      onChange={onChange}
    />,
  )
  fireEvent.click(screen.getByRole('combobox', { name: 'Source branch' }))
  expect(await screen.findByRole('option', { name: 'origin/main' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  expect(screen.getByRole('combobox', { name: 'Search source branch' })).toHaveValue('')
  expect(screen.getAllByRole('option')).toHaveLength(4)
})

it('supports keyboard selection and returns focus after cancelling an empty search', async () => {
  const onChange = vi.fn()
  render(
    <BranchSelect
      label="Target branch"
      value="refs/heads/main"
      catalog={catalog}
      onChange={onChange}
    />,
  )
  const trigger = screen.getByRole('combobox', { name: 'Target branch' })
  fireEvent.click(trigger)
  const search = await screen.findByRole('combobox', { name: 'Search target branch' })
  fireEvent.change(search, { target: { value: 'upstream' } })
  await waitFor(() => expect(search).toHaveAttribute('aria-activedescendant'))
  fireEvent.keyDown(search, { key: 'Enter' })
  expect(onChange).toHaveBeenCalledWith('refs/remotes/upstream/dev')
  await waitFor(() => expect(trigger).toHaveFocus())
  fireEvent.click(trigger)
  const nextSearch = await screen.findByRole('combobox', { name: 'Search target branch' })
  fireEvent.change(nextSearch, { target: { value: 'missing-branch' } })
  expect(await screen.findByText('No matching branches.')).toBeVisible()
  expect(screen.queryAllByRole('option')).toHaveLength(0)
  fireEvent.keyDown(nextSearch, { key: 'Escape' })
  await waitFor(() => expect(trigger).toHaveFocus())
  expect(onChange).toHaveBeenCalledTimes(1)
})

it('disables selection while loading and keeps a missing ref visible until replaced', async () => {
  const onChange = vi.fn()
  const view = render(
    <BranchSelect
      label="Source branch"
      value="refs/heads/deleted"
      catalog={null}
      onChange={onChange}
    />,
  )
  expect(screen.getByRole('combobox', { name: 'Source branch' })).toBeDisabled()
  expect(screen.getByText('deleted (unavailable)')).toBeVisible()
  view.rerender(
    <BranchSelect
      label="Source branch"
      value="refs/heads/deleted"
      catalog={catalog}
      onChange={onChange}
    />,
  )
  fireEvent.click(screen.getByRole('combobox', { name: 'Source branch' }))
  fireEvent.click(await screen.findByRole('option', { name: 'main' }))
  expect(onChange).toHaveBeenCalledWith('refs/heads/main')
})

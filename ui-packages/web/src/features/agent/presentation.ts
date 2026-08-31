export const agentProviderLabel = (provider: string | null): string | null => {
  if (provider === 'codex') return 'Codex'
  if (provider === 'claude') return 'Claude'
  return provider
}

export const agentDirectoryLabel = (cwd: string | null): string | null => {
  if (!cwd) return null
  const withoutTrailingSeparator = cwd.replace(/[\\/]+$/, '')
  if (!withoutTrailingSeparator) return cwd[0] ?? null
  return withoutTrailingSeparator.split(/[\\/]/).filter(Boolean).at(-1) ?? cwd
}

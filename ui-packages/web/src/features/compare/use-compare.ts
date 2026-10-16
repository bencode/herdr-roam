import type { CompareBranches, CompareFileView, Comparison } from '@herdr-roam/shared'
import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchProjectWorkspaces } from '../project/workspace-client'
import { fetchCompareBranches, fetchComparison, fetchComparisonFile } from './client'
import { filePath } from './file-path'
import { readComparePreferences, writeComparePreference } from './preferences'

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : 'The comparison could not be loaded.'

export const useCompare = (projectName: string, workspaceId: string, active: boolean) => {
  const [catalog, setCatalog] = useState<CompareBranches | null>(null)
  const [sourceRef, setSourceRef] = useState('')
  const [targetRef, setTargetRef] = useState('')
  const [comparison, setComparison] = useState<Comparison | null>(null)
  const [selectedPath, setSelectedPath] = useState('')
  const [file, setFile] = useState<CompareFileView | null>(null)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [compareError, setCompareError] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [fileLoading, setFileLoading] = useState(false)
  const [refreshId, setRefreshId] = useState(0)
  const pendingFile = useRef<AbortController | null>(null)
  const loadedCatalog = useRef(-1)
  const loadedComparison = useRef<{
    source: string
    target: string
    catalog: CompareBranches
  } | null>(null)
  const cache = useRef(new Map<string, CompareFileView>())
  const snapshot = useRef<{ base: string; source: string } | null>(null)
  const initialized = useRef(false)

  useEffect(() => {
    if (!active || loadedCatalog.current === refreshId) return
    const controller = new AbortController()
    setLoading(true)
    setCatalogError(null)
    void Promise.all([
      fetchCompareBranches(projectName, controller.signal),
      initialized.current
        ? Promise.resolve(null)
        : fetchProjectWorkspaces(projectName, controller.signal),
    ]).then(
      ([next, workspaces]) => {
        if (controller.signal.aborted) return
        if (!initialized.current) {
          const branch = workspaces?.items.find(item => item.id === workspaceId)?.branch
          setSourceRef(branch ? `refs/heads/${branch}` : '')
          setTargetRef(readComparePreferences().targets[projectName] ?? next.defaultTargetRef ?? '')
          initialized.current = true
        }
        loadedCatalog.current = refreshId
        setCatalog(next)
        setLoading(false)
      },
      error => {
        if (controller.signal.aborted) return
        setCatalogError(messageOf(error))
        setLoading(false)
      },
    )
    return () => controller.abort()
  }, [projectName, workspaceId, active, refreshId])

  useEffect(() => {
    if (!active || !catalog) return
    const loaded = loadedComparison.current
    if (loaded?.source === sourceRef && loaded.target === targetRef && loaded.catalog === catalog)
      return
    const controller = new AbortController()
    loadedComparison.current = null
    setCompareError(null)
    setFile(null)
    if (!sourceRef || !targetRef) {
      setComparison(null)
      setLoading(false)
      return
    }
    if (![sourceRef, targetRef].every(ref => catalog.items.some(item => item.ref === ref))) {
      setComparison(null)
      setLoading(false)
      setCompareError('A selected branch is unavailable. Choose the branches again.')
      return
    }
    setLoading(true)
    setComparison(null)
    void fetchComparison(projectName, sourceRef, targetRef, controller.signal).then(
      next => {
        if (controller.signal.aborted) return
        if (snapshot.current?.base !== next.baseOid || snapshot.current.source !== next.source.oid)
          cache.current.clear()
        snapshot.current = { base: next.baseOid, source: next.source.oid }
        loadedComparison.current = { source: sourceRef, target: targetRef, catalog }
        setComparison(next)
        setSelectedPath(current =>
          next.files.some(entry => filePath(entry) === current) ? current : '',
        )
        setLoading(false)
      },
      error => {
        if (controller.signal.aborted) return
        setCompareError(messageOf(error))
        setLoading(false)
      },
    )
    return () => controller.abort()
  }, [projectName, active, catalog, sourceRef, targetRef])

  const loadFile = useCallback(() => {
    pendingFile.current?.abort()
    if (!comparison || !selectedPath) return
    const cached = cache.current.get(selectedPath)
    setFileError(null)
    if (cached) {
      setFile(cached)
      setFileLoading(false)
      return
    }
    const controller = new AbortController()
    pendingFile.current = controller
    setFile(null)
    setFileLoading(true)
    void fetchComparisonFile(
      projectName,
      comparison.baseOid,
      comparison.source.oid,
      selectedPath,
      controller.signal,
    ).then(
      next => {
        if (controller.signal.aborted) return
        cache.current.set(selectedPath, next)
        setFile(next)
        setFileLoading(false)
      },
      error => {
        if (controller.signal.aborted) return
        setFileError(messageOf(error))
        setFileLoading(false)
      },
    )
  }, [projectName, comparison, selectedPath])

  useEffect(() => {
    if (!active) return
    loadFile()
    return () => pendingFile.current?.abort()
  }, [active, loadFile])

  return {
    catalog,
    sourceRef,
    targetRef,
    comparison,
    selectedPath,
    file: file && filePath(file.entry) === selectedPath ? file : null,
    loading,
    fileLoading,
    error: catalogError ?? compareError,
    fileError,
    selectSource: setSourceRef,
    selectTarget: (ref: string) => {
      setTargetRef(ref)
      writeComparePreference({ target: { projectName, ref } })
    },
    selectFile: setSelectedPath,
    refresh: () => setRefreshId(value => value + 1),
    retryFile: loadFile,
  }
}

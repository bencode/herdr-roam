import { useEffect, useId, useRef, useState } from 'react'
import styles from './style.module.scss'

type State =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly svg: string }
  | { readonly status: 'error' }

export const MermaidBlock = ({ source }: { readonly source: string }) => {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const diagramRef = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    let current = true
    setState({ status: 'loading' })
    void import('mermaid').then(
      async module => {
        module.default.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: 'neutral',
        })
        try {
          const result = await module.default.render(`roam-mermaid-${id}`, source)
          if (current) setState({ status: 'ready', svg: result.svg })
        } catch (error) {
          console.error('Mermaid diagram could not be rendered', error)
          if (current) setState({ status: 'error' })
        }
      },
      error => {
        console.error('Mermaid support could not be loaded', error)
        if (current) setState({ status: 'error' })
      },
    )
    return () => {
      current = false
    }
  }, [id, source])

  useEffect(() => {
    if (state.status !== 'ready' || !diagramRef.current) return
    const parsed = new DOMParser().parseFromString(state.svg, 'image/svg+xml')
    const svg = parsed.documentElement
    if (svg.tagName.toLowerCase() !== 'svg') {
      console.error('Mermaid returned an invalid SVG document')
      setState({ status: 'error' })
      return
    }
    diagramRef.current.replaceChildren(document.importNode(svg, true))
  }, [state])

  if (state.status === 'error') {
    return <div className={styles.diagramError}>Diagram preview is unavailable.</div>
  }
  if (state.status === 'loading') {
    return <div className={styles.diagramLoading}>Rendering diagram…</div>
  }
  return <div ref={diagramRef} className={styles.diagram} />
}

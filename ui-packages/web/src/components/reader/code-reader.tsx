import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter'
import styles from './style.module.scss'

type LanguageDefinition = Parameters<typeof SyntaxHighlighter.registerLanguage>[1]
type LanguageModule = Promise<{ readonly default: LanguageDefinition }>
type LanguageLoader = () => LanguageModule

const languageAliases: Readonly<Record<string, string>> = {
  dockerfile: 'bash',
  html: 'markup',
  makefile: 'bash',
  text: '',
  xml: 'markup',
}

const languageLoaders: Readonly<Record<string, LanguageLoader>> = {
  bash: () => import('react-syntax-highlighter/dist/esm/languages/prism/bash'),
  c: () => import('react-syntax-highlighter/dist/esm/languages/prism/c'),
  clojure: () => import('react-syntax-highlighter/dist/esm/languages/prism/clojure'),
  cpp: () => import('react-syntax-highlighter/dist/esm/languages/prism/cpp'),
  css: () => import('react-syntax-highlighter/dist/esm/languages/prism/css'),
  go: () => import('react-syntax-highlighter/dist/esm/languages/prism/go'),
  graphql: () => import('react-syntax-highlighter/dist/esm/languages/prism/graphql'),
  java: () => import('react-syntax-highlighter/dist/esm/languages/prism/java'),
  javascript: () => import('react-syntax-highlighter/dist/esm/languages/prism/javascript'),
  json: () => import('react-syntax-highlighter/dist/esm/languages/prism/json'),
  jsx: () => import('react-syntax-highlighter/dist/esm/languages/prism/jsx'),
  markdown: () => import('react-syntax-highlighter/dist/esm/languages/prism/markdown'),
  markup: () => import('react-syntax-highlighter/dist/esm/languages/prism/markup'),
  python: () => import('react-syntax-highlighter/dist/esm/languages/prism/python'),
  rust: () => import('react-syntax-highlighter/dist/esm/languages/prism/rust'),
  scss: () => import('react-syntax-highlighter/dist/esm/languages/prism/scss'),
  sql: () => import('react-syntax-highlighter/dist/esm/languages/prism/sql'),
  toml: () => import('react-syntax-highlighter/dist/esm/languages/prism/toml'),
  tsx: () => import('react-syntax-highlighter/dist/esm/languages/prism/tsx'),
  typescript: () => import('react-syntax-highlighter/dist/esm/languages/prism/typescript'),
  yaml: () => import('react-syntax-highlighter/dist/esm/languages/prism/yaml'),
}

const registeredLanguages = new Set<string>()

const syntaxTheme: Readonly<Record<string, CSSProperties>> = {
  'code[class*="language-"]': { color: 'var(--foreground)' },
  'pre[class*="language-"]': { color: 'var(--foreground)', background: 'transparent' },
  comment: { color: 'var(--faint)' },
  punctuation: { color: 'var(--muted)' },
  property: { color: 'var(--primary)' },
  tag: { color: 'var(--primary)' },
  boolean: { color: 'var(--warning)' },
  number: { color: 'var(--warning)' },
  string: { color: 'var(--success)' },
  keyword: { color: 'var(--primary)' },
  function: { color: 'var(--foreground)' },
  operator: { color: 'var(--muted)' },
}

export const CodeReader = ({
  content,
  language,
}: {
  readonly content: string
  readonly language: string
}) => {
  const resolvedLanguage = languageAliases[language] ?? language
  const loader = languageLoaders[resolvedLanguage]
  const [loaded, setLoaded] = useState(() => !loader || registeredLanguages.has(resolvedLanguage))

  useEffect(() => {
    if (!loader || registeredLanguages.has(resolvedLanguage)) {
      setLoaded(true)
      return
    }
    let current = true
    setLoaded(false)
    void loader().then(
      module => {
        SyntaxHighlighter.registerLanguage(resolvedLanguage, module.default)
        registeredLanguages.add(resolvedLanguage)
        if (current) setLoaded(true)
      },
      error => {
        console.error(`Syntax support for ${resolvedLanguage} could not be loaded`, error)
        if (current) setLoaded(true)
      },
    )
    return () => {
      current = false
    }
  }, [loader, resolvedLanguage])

  return (
    <section className={styles.code} aria-label={`${language} source`} aria-busy={!loaded}>
      <SyntaxHighlighter
        language={loaded ? resolvedLanguage || undefined : undefined}
        style={syntaxTheme}
        showLineNumbers
        wrapLongLines={false}
        customStyle={{ margin: 0, minHeight: '100%', background: 'transparent', padding: '1.5rem' }}
        lineNumberStyle={{ color: 'var(--faint)', minWidth: '3.25em', paddingRight: '1.25em' }}
      >
        {content}
      </SyntaxHighlighter>
    </section>
  )
}

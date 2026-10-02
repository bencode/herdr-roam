import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter'
import styles from './style.module.scss'

type LanguageDefinition = Parameters<typeof SyntaxHighlighter.registerLanguage>[1]
type LanguageModule = Promise<{ readonly default: LanguageDefinition }>
type LanguageLoader = () => LanguageModule

const languageAliases: Readonly<Record<string, string>> = {
  dockerfile: 'docker',
  html: 'markup',
  text: '',
  xml: 'markup',
}

const languageLoaders: Readonly<Record<string, LanguageLoader>> = {
  bash: () => import('react-syntax-highlighter/dist/esm/languages/prism/bash'),
  c: () => import('react-syntax-highlighter/dist/esm/languages/prism/c'),
  clojure: () => import('react-syntax-highlighter/dist/esm/languages/prism/clojure'),
  cmake: () => import('react-syntax-highlighter/dist/esm/languages/prism/cmake'),
  cpp: () => import('react-syntax-highlighter/dist/esm/languages/prism/cpp'),
  csharp: () => import('react-syntax-highlighter/dist/esm/languages/prism/csharp'),
  css: () => import('react-syntax-highlighter/dist/esm/languages/prism/css'),
  dart: () => import('react-syntax-highlighter/dist/esm/languages/prism/dart'),
  diff: () => import('react-syntax-highlighter/dist/esm/languages/prism/diff'),
  docker: () => import('react-syntax-highlighter/dist/esm/languages/prism/docker'),
  elixir: () => import('react-syntax-highlighter/dist/esm/languages/prism/elixir'),
  elm: () => import('react-syntax-highlighter/dist/esm/languages/prism/elm'),
  erlang: () => import('react-syntax-highlighter/dist/esm/languages/prism/erlang'),
  fsharp: () => import('react-syntax-highlighter/dist/esm/languages/prism/fsharp'),
  go: () => import('react-syntax-highlighter/dist/esm/languages/prism/go'),
  graphql: () => import('react-syntax-highlighter/dist/esm/languages/prism/graphql'),
  groovy: () => import('react-syntax-highlighter/dist/esm/languages/prism/groovy'),
  haskell: () => import('react-syntax-highlighter/dist/esm/languages/prism/haskell'),
  hcl: () => import('react-syntax-highlighter/dist/esm/languages/prism/hcl'),
  ini: () => import('react-syntax-highlighter/dist/esm/languages/prism/ini'),
  java: () => import('react-syntax-highlighter/dist/esm/languages/prism/java'),
  javascript: () => import('react-syntax-highlighter/dist/esm/languages/prism/javascript'),
  json: () => import('react-syntax-highlighter/dist/esm/languages/prism/json'),
  jsx: () => import('react-syntax-highlighter/dist/esm/languages/prism/jsx'),
  julia: () => import('react-syntax-highlighter/dist/esm/languages/prism/julia'),
  kotlin: () => import('react-syntax-highlighter/dist/esm/languages/prism/kotlin'),
  latex: () => import('react-syntax-highlighter/dist/esm/languages/prism/latex'),
  less: () => import('react-syntax-highlighter/dist/esm/languages/prism/less'),
  lisp: () => import('react-syntax-highlighter/dist/esm/languages/prism/lisp'),
  lua: () => import('react-syntax-highlighter/dist/esm/languages/prism/lua'),
  makefile: () => import('react-syntax-highlighter/dist/esm/languages/prism/makefile'),
  markdown: () => import('react-syntax-highlighter/dist/esm/languages/prism/markdown'),
  markup: () => import('react-syntax-highlighter/dist/esm/languages/prism/markup'),
  nim: () => import('react-syntax-highlighter/dist/esm/languages/prism/nim'),
  nix: () => import('react-syntax-highlighter/dist/esm/languages/prism/nix'),
  ocaml: () => import('react-syntax-highlighter/dist/esm/languages/prism/ocaml'),
  perl: () => import('react-syntax-highlighter/dist/esm/languages/prism/perl'),
  php: () => import('react-syntax-highlighter/dist/esm/languages/prism/php'),
  powershell: () => import('react-syntax-highlighter/dist/esm/languages/prism/powershell'),
  protobuf: () => import('react-syntax-highlighter/dist/esm/languages/prism/protobuf'),
  python: () => import('react-syntax-highlighter/dist/esm/languages/prism/python'),
  r: () => import('react-syntax-highlighter/dist/esm/languages/prism/r'),
  racket: () => import('react-syntax-highlighter/dist/esm/languages/prism/racket'),
  ruby: () => import('react-syntax-highlighter/dist/esm/languages/prism/ruby'),
  rust: () => import('react-syntax-highlighter/dist/esm/languages/prism/rust'),
  sass: () => import('react-syntax-highlighter/dist/esm/languages/prism/sass'),
  scala: () => import('react-syntax-highlighter/dist/esm/languages/prism/scala'),
  scheme: () => import('react-syntax-highlighter/dist/esm/languages/prism/scheme'),
  scss: () => import('react-syntax-highlighter/dist/esm/languages/prism/scss'),
  sql: () => import('react-syntax-highlighter/dist/esm/languages/prism/sql'),
  swift: () => import('react-syntax-highlighter/dist/esm/languages/prism/swift'),
  toml: () => import('react-syntax-highlighter/dist/esm/languages/prism/toml'),
  tsx: () => import('react-syntax-highlighter/dist/esm/languages/prism/tsx'),
  typescript: () => import('react-syntax-highlighter/dist/esm/languages/prism/typescript'),
  vim: () => import('react-syntax-highlighter/dist/esm/languages/prism/vim'),
  yaml: () => import('react-syntax-highlighter/dist/esm/languages/prism/yaml'),
  zig: () => import('react-syntax-highlighter/dist/esm/languages/prism/zig'),
}

const registeredLanguages = new Set<string>()

const syntaxTheme: Readonly<Record<string, CSSProperties>> = {
  'code[class*="language-"]': { color: 'var(--foreground)' },
  'pre[class*="language-"]': { color: 'var(--foreground)', background: 'transparent' },
  comment: { color: 'var(--syntax-comment)', fontStyle: 'italic' },
  prolog: { color: 'var(--syntax-comment)' },
  keyword: { color: 'var(--syntax-keyword)' },
  tag: { color: 'var(--syntax-keyword)' },
  boolean: { color: 'var(--syntax-keyword)' },
  string: { color: 'var(--syntax-string)' },
  'attr-value': { color: 'var(--syntax-string)' },
  inserted: { color: 'var(--syntax-string)' },
  number: { color: 'var(--syntax-number)' },
  builtin: { color: 'var(--syntax-number)' },
  'attr-name': { color: 'var(--syntax-number)' },
  function: { color: 'var(--syntax-title)' },
  'class-name': { color: 'var(--syntax-title)' },
  title: { color: 'var(--syntax-title)', fontWeight: 600 },
  property: { color: 'var(--syntax-variable)' },
  variable: { color: 'var(--syntax-variable)' },
  url: { color: 'var(--syntax-variable)' },
  punctuation: { color: 'var(--syntax-punct)' },
  operator: { color: 'var(--syntax-punct)' },
  deleted: { color: 'var(--syntax-deletion)' },
  bold: { fontWeight: 600 },
  italic: { fontStyle: 'italic' },
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

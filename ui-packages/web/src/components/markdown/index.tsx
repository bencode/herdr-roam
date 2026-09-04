import type { ComponentProps, ReactNode } from 'react'
import { isValidElement, lazy, Suspense, useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'
import { cn } from '../../lib/cn'
import styles from './style.module.scss'

type RemarkMath = typeof import('remark-math')['default']
type RehypeKatex = typeof import('rehype-katex')['default']
type HeadingProps = ComponentProps<'h2'>

const MermaidBlock = lazy(() =>
  import('./mermaid-block').then(module => ({ default: module.MermaidBlock })),
)

const shiftedHeadings = {
  h1: (props: HeadingProps) => <h2 {...props} />,
  h2: (props: HeadingProps) => <h3 {...props} />,
  h3: (props: HeadingProps) => <h4 {...props} />,
  h4: (props: HeadingProps) => <h5 {...props} />,
  h5: (props: HeadingProps) => <h6 {...props} />,
  h6: (props: HeadingProps) => <h6 {...props} />,
}

const containsMath = (text: string): boolean =>
  text.includes('$$') || /(^|[^\\])\$[^\s$][^\n$]*\$/m.test(text)

const MermaidFallback = ({ children }: { readonly children: ReactNode }) => (
  <pre className={styles.diagramFallback}>
    <code>{children}</code>
  </pre>
)

export const Markdown = ({
  text,
  className,
  headingLevelOffset = 0,
  resolveImageSrc,
  onLink,
}: {
  readonly text: string
  readonly className?: string
  readonly headingLevelOffset?: 0 | 1
  readonly resolveImageSrc?: (src: string) => string
  readonly onLink?: (href: string) => boolean
}) => {
  const math = containsMath(text)
  const [mathPlugins, setMathPlugins] = useState<{
    readonly remark: RemarkMath
    readonly rehype: RehypeKatex
  } | null>(null)

  useEffect(() => {
    if (!math || mathPlugins) return
    let current = true
    void Promise.all([
      import('remark-math'),
      import('rehype-katex'),
      import('katex/dist/katex.min.css'),
    ]).then(
      ([remark, rehype]) => {
        if (current) setMathPlugins({ remark: remark.default, rehype: rehype.default })
      },
      error => console.error('Markdown math support could not be loaded', error),
    )
    return () => {
      current = false
    }
  }, [math, mathPlugins])

  return (
    <div className={cn(styles.markdown, className)}>
      <ReactMarkdown
        remarkPlugins={mathPlugins ? [remarkGfm, mathPlugins.remark] : [remarkGfm]}
        rehypePlugins={mathPlugins ? [rehypeHighlight, mathPlugins.rehype] : [rehypeHighlight]}
        components={{
          a: ({ children, href, ...props }: ComponentProps<'a'>) => (
            <a
              {...props}
              href={href}
              target={onLink ? undefined : '_blank'}
              rel={onLink ? undefined : 'noreferrer'}
              onClick={event => {
                if (href && onLink?.(href)) event.preventDefault()
              }}
            >
              {children}
            </a>
          ),
          img: ({ src, alt, ...props }: ComponentProps<'img'>) => (
            <img
              {...props}
              src={src && resolveImageSrc ? resolveImageSrc(src) : src}
              alt={alt ?? ''}
            />
          ),
          pre: ({ children, ...props }: ComponentProps<'pre'>) => {
            const child = Array.isArray(children) ? children[0] : children
            if (
              isValidElement<{ readonly className?: string; readonly children?: ReactNode }>(
                child,
              ) &&
              child.props.className?.split(' ').includes('language-mermaid')
            ) {
              const source = String(child.props.children).replace(/\n$/, '')
              return (
                <Suspense fallback={<MermaidFallback>{source}</MermaidFallback>}>
                  <MermaidBlock source={source} />
                </Suspense>
              )
            }
            return <pre {...props}>{children}</pre>
          },
          ...(headingLevelOffset === 1 ? shiftedHeadings : {}),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}

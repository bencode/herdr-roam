import type { ComponentProps } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'
import { cn } from '../../lib/cn'
import styles from './style.module.scss'

export const Markdown = ({
  text,
  className,
}: {
  readonly text: string
  readonly className?: string
}) => (
  <div className={cn(styles.markdown, className)}>
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      components={{
        a: ({ children, ...props }: ComponentProps<'a'>) => (
          <a {...props} target="_blank" rel="noreferrer">
            {children}
          </a>
        ),
      }}
    >
      {text}
    </ReactMarkdown>
  </div>
)

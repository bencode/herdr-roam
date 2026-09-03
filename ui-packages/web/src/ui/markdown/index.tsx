import type { ComponentProps } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'
import { cn } from '../../lib/cn'
import styles from './style.module.scss'

type HeadingProps = ComponentProps<'h2'>

const shiftedHeadings = {
  h1: (props: HeadingProps) => <h2 {...props} />,
  h2: (props: HeadingProps) => <h3 {...props} />,
  h3: (props: HeadingProps) => <h4 {...props} />,
  h4: (props: HeadingProps) => <h5 {...props} />,
  h5: (props: HeadingProps) => <h6 {...props} />,
  h6: (props: HeadingProps) => <h6 {...props} />,
}

export const Markdown = ({
  text,
  className,
  headingLevelOffset = 0,
}: {
  readonly text: string
  readonly className?: string
  readonly headingLevelOffset?: 0 | 1
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
        ...(headingLevelOffset === 1 ? shiftedHeadings : {}),
      }}
    >
      {text}
    </ReactMarkdown>
  </div>
)

import { registerCustomCSSVariableTheme } from '@pierre/diffs'

export const registerCompareTheme = (): void => {
  registerCustomCSSVariableTheme('roam', {
    foreground: 'var(--foreground)',
    background: 'var(--surface)',
    'token-comment': 'var(--syntax-comment)',
    'token-keyword': 'var(--syntax-keyword)',
    'token-string': 'var(--syntax-string)',
    'token-constant': 'var(--syntax-number)',
    'token-function': 'var(--syntax-title)',
    'token-parameter': 'var(--syntax-variable)',
    'token-punctuation': 'var(--syntax-punct)',
    'token-string-expression': 'var(--syntax-string)',
    'token-link': 'var(--syntax-title)',
  })
}

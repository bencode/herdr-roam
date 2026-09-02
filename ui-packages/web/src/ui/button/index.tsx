import type { ComponentPropsWithRef } from 'react'
import { cn } from '../../lib/cn'
import styles from './style.module.scss'

type ButtonVariant = 'ghost' | 'secondary' | 'primary' | 'danger' | 'dangerGhost'
type ButtonSize = 'compact' | 'default' | 'compactIcon' | 'defaultIcon'

type ButtonProps = ComponentPropsWithRef<'button'> & {
  readonly variant?: ButtonVariant
  readonly size?: ButtonSize
}

const variantClasses: Readonly<Record<ButtonVariant, string | undefined>> = {
  ghost: styles.ghost,
  secondary: styles.secondary,
  primary: styles.primary,
  danger: styles.danger,
  dangerGhost: styles.dangerGhost,
}

const sizeClasses: Readonly<Record<ButtonSize, string | undefined>> = {
  compact: styles.compact,
  default: styles.defaultSize,
  compactIcon: styles.compactIcon,
  defaultIcon: styles.defaultIcon,
}

export const Button = ({
  className,
  variant = 'ghost',
  size = 'default',
  type = 'button',
  ...props
}: ButtonProps) => (
  <button
    {...props}
    type={type}
    className={cn(styles.button, variantClasses[variant], sizeClasses[size], className)}
  />
)

import { cva } from 'class-variance-authority'

/** Shared look for IDE-style tab strips; behaviour (keyboard, menus, closing) stays with each strip. */
export const tabShellVariants = cva(
  'group flex min-w-32 max-w-55 flex-[0_1_11.875rem] items-stretch border-border border-r text-muted max-[68rem]:basis-37.5',
  {
    variants: {
      selected: {
        true: "relative z-1 bg-surface text-foreground shadow-[inset_0_2px_var(--foreground)] after:pointer-events-none after:absolute after:right-0 after:bottom-[-1px] after:left-0 after:h-px after:bg-surface after:content-['']",
        false: '',
      },
    },
    defaultVariants: { selected: false },
  },
)

export const tabTriggerClass =
  'flex min-w-0 flex-1 items-center gap-1.5 border-0 bg-transparent pr-1.5 pl-2.5 text-left text-xs text-inherit hover:bg-hover hover:text-foreground group-[.bg-surface]:hover:bg-transparent [&>span]:truncate [&>span]:min-w-0 [&>svg]:size-3.5 [&>svg]:flex-none [&>svg]:text-faint group-[.bg-surface]:[&>svg]:text-foreground'

export const tabCloseClass =
  'grid size-6 flex-none place-items-center self-center rounded-sm border-0 bg-transparent text-muted opacity-0 hover:bg-hover hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 group-[.bg-surface]:opacity-100 [&>svg]:w-3'

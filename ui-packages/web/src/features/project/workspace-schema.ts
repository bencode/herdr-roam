import { z } from 'zod'

export const workspaceCatalogSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        path: z.string().min(1),
        kind: z.enum(['directory', 'worktree']),
        branch: z.string().min(1).nullable(),
        primary: z.boolean(),
      }),
    )
    .readonly(),
})

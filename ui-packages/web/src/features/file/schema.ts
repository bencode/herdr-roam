import { z } from 'zod'

const entrySchema = z.object({
  kind: z.enum(['directory', 'file']),
  name: z.string().min(1),
  path: z.string().min(1),
})

export const filePageSchema = z.object({
  items: z.array(entrySchema).readonly(),
  total: z.number().int().nonnegative(),
  nextCursor: z.string().min(1).nullable(),
})

const metadata = {
  path: z.string().min(1),
  name: z.string().min(1),
  size: z.number().int().nonnegative(),
  modifiedAt: z.string().min(1),
  mediaType: z.string().min(1),
}

export const fileViewSchema = z.discriminatedUnion('kind', [
  z.object({
    ...metadata,
    kind: z.enum(['markdown', 'html', 'mermaid', 'text']),
    language: z.string().min(1),
    content: z.string(),
  }),
  z.object({ ...metadata, kind: z.literal('image') }),
  z.object({ ...metadata, kind: z.literal('binary') }),
  z.object({
    ...metadata,
    kind: z.literal('oversized'),
    previewKind: z.enum(['text', 'image']),
    limit: z.number().int().positive(),
  }),
])

import { z } from 'zod'

const statusSchema = z.enum(['open', 'closed'])
const typeSchema = z.enum(['task', 'bug', 'feature'])
const prioritySchema = z.enum(['p0', 'p1', 'p2', 'p3'])

const summarySchema = z.object({
  id: z.uuid(),
  title: z.string().min(1),
  status: statusSchema,
  type: typeSchema.optional(),
  priority: prioritySchema.optional(),
  labels: z.array(z.string()).readonly(),
  path: z.string().min(1),
})

export const issueCatalogSchema = z.object({
  items: z.array(summarySchema).readonly(),
  warnings: z
    .array(
      z.object({
        path: z.string().min(1),
        code: z.enum(['invalid_issue', 'issue_unavailable']),
        message: z.string().min(1),
      }),
    )
    .readonly(),
})

export const issueDetailSchema = summarySchema.extend({ body: z.string() })

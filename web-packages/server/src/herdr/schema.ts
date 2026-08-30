import { z } from 'zod'

export const herdrStatusSchema = z.object({
  running: z.boolean(),
  version: z.string(),
  protocol: z.number().int(),
  compatible: z.boolean(),
  socket: z.string().nullable(),
})

export const rawAgentSchema = z.object({
  terminal_id: z.string().min(1),
  agent_status: z.enum(['idle', 'working', 'blocked', 'done', 'unknown']),
  workspace_id: z.string(),
  tab_id: z.string(),
  pane_id: z.string().min(1),
  agent: z.string().nullable().optional(),
  cwd: z.string().nullable().optional(),
  display_agent: z.string().nullable().optional(),
  foreground_cwd: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  terminal_title_stripped: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  launch_pending: z.boolean().optional(),
  interactive_ready: z.boolean().optional(),
})

export type RawAgent = z.infer<typeof rawAgentSchema>

export const agentListResultSchema = z.object({
  type: z.literal('agent_list'),
  agents: z.array(rawAgentSchema),
})

export const paneReadResultSchema = z.object({
  type: z.literal('pane_read'),
  read: z.object({ text: z.string() }),
})

export const agentPromptedResultSchema = z.object({
  type: z.literal('agent_prompted'),
  agent: z.object({}).passthrough(),
})

export const agentInfoResultSchema = z.object({
  type: z.literal('agent_info'),
  agent: rawAgentSchema,
})

export const agentStartedResultSchema = z.object({
  type: z.literal('agent_started'),
  agent: rawAgentSchema,
  argv: z.array(z.string()),
})

export const workspaceCreatedResultSchema = z.object({
  type: z.literal('workspace_created'),
  workspace: z.object({ workspace_id: z.string().min(1) }).passthrough(),
  root_pane: z
    .object({ pane_id: z.string().min(1), terminal_id: z.string().min(1) })
    .passthrough(),
})

export const subscriptionStartedSchema = z.object({
  type: z.literal('subscription_started'),
})

export const successResponseSchema = z.object({
  id: z.string(),
  result: z.unknown(),
})

export const errorResponseSchema = z.object({
  id: z.string(),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
})

export const eventEnvelopeSchema = z.object({
  event: z.string(),
  data: z.unknown(),
})

import { z } from 'zod';
import { TASK_LOG_STATUSES } from '../../../domain/task.js';
import { pageQueryShape } from './pagination.schema.js';

/** `GET /tasks/:id/logs`: the task comes from the path. */
export const taskLogsQuerySchema = z.object({
  status: z.enum(TASK_LOG_STATUSES).optional(),
  ...pageQueryShape,
});

/** `GET /logs`: optionally narrowed to one task. */
export const listLogsQuerySchema = taskLogsQuerySchema.extend({
  taskId: z.uuid('taskId must be a UUID').optional(),
});

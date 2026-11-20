import { Router } from 'express';
import type { ListLogs } from '../../../application/logs/list-logs.js';
import { toLogResponse } from '../presenters/log.presenter.js';
import { toPageResponse } from '../presenters/task.presenter.js';
import { listLogsQuerySchema, taskLogsQuerySchema } from '../schemas/log.schema.js';
import { taskIdParamsSchema } from '../schemas/task.schema.js';
import { parseInput } from '../validation.js';

export function createLogsRouter(listLogs: ListLogs): Router {
  const router = Router();

  router.get('/logs', async (req, res) => {
    const query = parseInput(listLogsQuerySchema, req.query);
    res.json(toPageResponse(await listLogs.execute(query), toLogResponse));
  });

  router.get('/tasks/:id/logs', async (req, res) => {
    const { id } = parseInput(taskIdParamsSchema, req.params);
    const query = parseInput(taskLogsQuerySchema, req.query);
    res.json(toPageResponse(await listLogs.execute({ ...query, taskId: id }), toLogResponse));
  });

  return router;
}

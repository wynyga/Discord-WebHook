import { Router } from 'express';
import type { TaskUseCases } from '../../../application/tasks/index.js';
import { toPageResponse, toTaskDetailResponse, toTaskResponse } from '../presenters/task.presenter.js';
import { createTaskSchema, listTasksQuerySchema, taskIdParamsSchema, updateTaskSchema } from '../schemas/task.schema.js';
import { parseInput } from '../validation.js';

export function createTasksRouter(tasks: TaskUseCases): Router {
  const router = Router();

  router.post('/tasks', async (req, res) => {
    const input = parseInput(createTaskSchema, req.body);
    const task = await tasks.create.execute(input);
    res.status(201).location(`/tasks/${task.id}`).json({ data: toTaskResponse(task) });
  });

  router.get('/tasks', async (req, res) => {
    const query = parseInput(listTasksQuerySchema, req.query);
    const page = await tasks.list.execute(query);
    res.json(toPageResponse(page, (task) => toTaskResponse(task)));
  });

  router.get('/tasks/:id', async (req, res) => {
    const { id } = parseInput(taskIdParamsSchema, req.params);
    res.json({ data: toTaskDetailResponse(await tasks.get.execute(id)) });
  });

  router.patch('/tasks/:id', async (req, res) => {
    const { id } = parseInput(taskIdParamsSchema, req.params);
    const changes = parseInput(updateTaskSchema, req.body);
    res.json({ data: toTaskResponse(await tasks.update.execute(id, changes)) });
  });

  router.delete('/tasks/:id', async (req, res) => {
    const { id } = parseInput(taskIdParamsSchema, req.params);
    await tasks.delete.execute(id);
    res.status(204).end();
  });

  router.post('/tasks/:id/pause', async (req, res) => {
    const { id } = parseInput(taskIdParamsSchema, req.params);
    res.json({ data: toTaskResponse(await tasks.pause.execute(id)) });
  });

  router.post('/tasks/:id/resume', async (req, res) => {
    const { id } = parseInput(taskIdParamsSchema, req.params);
    res.json({ data: toTaskResponse(await tasks.resume.execute(id)) });
  });

  // 202: the run is queued; its result shows up in the task's logs.
  router.post('/tasks/:id/run', async (req, res) => {
    const { id } = parseInput(taskIdParamsSchema, req.params);
    await tasks.runNow.execute(id);
    res.status(202).json({ data: { taskId: id, status: 'queued' } });
  });

  return router;
}

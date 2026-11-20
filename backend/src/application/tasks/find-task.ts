import { NotFoundError } from '../../domain/errors.js';
import type { Task } from '../../domain/task.js';
import type { TaskRepository } from '../../domain/task-repository.js';

export async function findTaskOrThrow(tasks: TaskRepository, id: string): Promise<Task> {
  const task = await tasks.findById(id);
  if (!task) throw new NotFoundError(`Task ${id} not found`);
  return task;
}

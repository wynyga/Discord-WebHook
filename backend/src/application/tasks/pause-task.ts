import { NotFoundError } from '../../domain/errors.js';
import type { SchedulerPort } from '../../domain/scheduler.js';
import type { Task } from '../../domain/task.js';
import type { TaskRepository } from '../../domain/task-repository.js';
import { findTaskOrThrow } from './find-task.js';

export class PauseTask {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly scheduler: SchedulerPort,
  ) {}

  /** Idempotent: pausing a paused task returns it unchanged. */
  async execute(id: string): Promise<Task> {
    const task = await findTaskOrThrow(this.tasks, id);
    if (task.status === 'paused') return task;

    await this.scheduler.remove(id);
    const paused = await this.tasks.update(id, { status: 'paused' });
    if (!paused) throw new NotFoundError(`Task ${id} not found`);
    return paused;
  }
}

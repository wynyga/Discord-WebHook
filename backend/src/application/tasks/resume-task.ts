import { NotFoundError } from '../../domain/errors.js';
import type { SchedulerPort } from '../../domain/scheduler.js';
import type { Task } from '../../domain/task.js';
import type { TaskRepository } from '../../domain/task-repository.js';
import { findTaskOrThrow } from './find-task.js';

export class ResumeTask {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly scheduler: SchedulerPort,
  ) {}

  /** Idempotent: only a paused task changes; others are returned as they are. */
  async execute(id: string): Promise<Task> {
    const task = await findTaskOrThrow(this.tasks, id);
    if (task.status !== 'paused') return task;

    const resumed = await this.tasks.update(id, { status: 'active' });
    if (!resumed) throw new NotFoundError(`Task ${id} not found`);
    await this.scheduler.upsert(resumed);
    return resumed;
  }
}

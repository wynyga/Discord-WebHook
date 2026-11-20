import type { SchedulerPort } from '../../domain/scheduler.js';
import type { TaskRepository } from '../../domain/task-repository.js';
import { findTaskOrThrow } from './find-task.js';

export class RunTaskNow {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly scheduler: SchedulerPort,
  ) {}

  /** Queues one run with the task's retry policy; works for paused tasks too and keeps them paused. */
  async execute(id: string): Promise<void> {
    const task = await findTaskOrThrow(this.tasks, id);
    await this.scheduler.runNow(task);
  }
}

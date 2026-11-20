import type { SchedulerPort } from '../../domain/scheduler.js';
import type { TaskRepository } from '../../domain/task-repository.js';
import { findTaskOrThrow } from './find-task.js';

export class DeleteTask {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly scheduler: SchedulerPort,
  ) {}

  /** Removes the schedule first, so a run cannot start for a task that is gone. */
  async execute(id: string): Promise<void> {
    await findTaskOrThrow(this.tasks, id);
    await this.scheduler.remove(id);
    await this.tasks.delete(id);
  }
}

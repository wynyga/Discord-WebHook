import { NotFoundError } from '../../domain/errors.js';
import { assertRetryWindowFits } from '../../domain/schedule.js';
import type { SchedulerPort } from '../../domain/scheduler.js';
import type { Task, TaskInput } from '../../domain/task.js';
import type { TaskRepository } from '../../domain/task-repository.js';
import { findTaskOrThrow } from './find-task.js';

/** Omitted fields keep their stored value, including `webhookUrl`, which clients only see masked. */
export type TaskUpdate = Partial<TaskInput>;

export class UpdateTask {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly scheduler: SchedulerPort,
  ) {}

  async execute(id: string, changes: TaskUpdate): Promise<Task> {
    const current = await findTaskOrThrow(this.tasks, id);
    assertRetryWindowFits({ ...current, ...changes });

    const updated = await this.tasks.update(id, changes);
    if (!updated) throw new NotFoundError(`Task ${id} not found`);

    // A paused task gets its schedule back on resume, with whatever was saved meanwhile.
    if (updated.status !== 'paused') await this.scheduler.upsert(updated);
    return updated;
  }
}

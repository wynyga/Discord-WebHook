import type { SchedulerPort } from '../../domain/scheduler.js';
import type { TaskRepository } from '../../domain/task-repository.js';

/**
 * Makes the scheduler match the database at boot: every non-paused task gets a schedule, and
 * schedules of deleted or paused tasks are removed. The database is the source of truth.
 */
export class ReconcileSchedules {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly scheduler: SchedulerPort,
  ) {}

  async execute(): Promise<{ scheduled: number; removed: number }> {
    const schedulable = await this.tasks.listSchedulable();
    for (const task of schedulable) await this.scheduler.upsert(task);

    const keep = new Set(schedulable.map((task) => task.id));
    const stale = (await this.scheduler.scheduledTaskIds()).filter((id) => !keep.has(id));
    for (const id of stale) await this.scheduler.remove(id);

    return { scheduled: schedulable.length, removed: stale.length };
  }
}

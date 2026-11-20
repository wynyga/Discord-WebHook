import type { Queue } from 'bullmq';
import type { SchedulerPort } from '../../domain/scheduler.js';
import type { Task } from '../../domain/task.js';
import {
  EXECUTE_JOB_NAME,
  jobOptionsFor,
  schedulerIdFor,
  taskIdFromSchedulerId,
  type TaskJobData,
} from './task-queue.js';

export type TaskQueue = Pick<Queue<TaskJobData>, 'upsertJobScheduler' | 'removeJobScheduler' | 'add' | 'getJobSchedulers'>;

/** One BullMQ job scheduler per task, keyed by task id, so upserts replace instead of duplicating. */
export class BullMqScheduler implements SchedulerPort {
  constructor(private readonly queue: TaskQueue) {}

  async upsert(task: Task): Promise<void> {
    await this.queue.upsertJobScheduler(
      schedulerIdFor(task.id),
      { pattern: task.cronSchedule, tz: task.timezone },
      { name: EXECUTE_JOB_NAME, data: { taskId: task.id, trigger: 'schedule' }, opts: jobOptionsFor(task) },
    );
  }

  async remove(taskId: string): Promise<void> {
    await this.queue.removeJobScheduler(schedulerIdFor(taskId));
  }

  async runNow(task: Task): Promise<void> {
    await this.queue.add(EXECUTE_JOB_NAME, { taskId: task.id, trigger: 'manual' }, jobOptionsFor(task));
  }

  async scheduledTaskIds(): Promise<string[]> {
    const schedulers = await this.queue.getJobSchedulers();
    return schedulers.map((s) => taskIdFromSchedulerId(s.key)).filter((id): id is string => id !== null);
  }
}

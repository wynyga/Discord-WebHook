import type { Task } from './task.js';

/** Keeps the external schedule (BullMQ) in step with a task. */
export interface SchedulerPort {
  /** Registers or replaces the recurring schedule of an active task. */
  upsert(task: Task): Promise<void>;
  remove(taskId: string): Promise<void>;
  /** Queues one immediate execution, outside the schedule. */
  runNow(task: Task): Promise<void>;
}

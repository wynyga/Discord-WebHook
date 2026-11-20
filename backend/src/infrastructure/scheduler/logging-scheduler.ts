import type { SchedulerPort } from '../../domain/scheduler.js';
import type { Task } from '../../domain/task.js';
import type { Logger } from '../logger.js';

/**
 * Stand-in that only logs. Phase 4 replaces it with the BullMQ adapter in the composition root.
 */
export class LoggingScheduler implements SchedulerPort {
  constructor(private readonly logger: Logger) {}

  async upsert(task: Task): Promise<void> {
    this.logger.warn({ taskId: task.id, cron: task.cronSchedule }, 'Scheduler not wired: upsert skipped');
  }

  async remove(taskId: string): Promise<void> {
    this.logger.warn({ taskId }, 'Scheduler not wired: remove skipped');
  }

  async runNow(task: Task): Promise<void> {
    this.logger.warn({ taskId: task.id }, 'Scheduler not wired: run skipped');
  }
}

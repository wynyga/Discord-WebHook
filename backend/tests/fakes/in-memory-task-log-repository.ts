import { randomUUID } from 'node:crypto';
import type { Page } from '../../src/domain/pagination.js';
import { TASK_LOG_STATUSES, type TaskLog, type TaskLogStatus } from '../../src/domain/task.js';
import type {
  NewTaskLog,
  TaskLogEntry,
  TaskLogListQuery,
  TaskLogRepository,
} from '../../src/domain/task-log-repository.js';
import type { InMemoryTaskRepository } from './in-memory-task-repository.js';

export class InMemoryTaskLogRepository implements TaskLogRepository {
  readonly rows: TaskLog[] = [];

  /** Joins task names like the SQL repository does. */
  constructor(private readonly tasks?: InMemoryTaskRepository) {}

  async create(log: NewTaskLog): Promise<TaskLog> {
    const row: TaskLog = { ...log, id: randomUUID(), createdAt: log.executedAt };
    this.rows.push(row);
    return { ...row };
  }

  async list({ taskId, status, page, pageSize }: TaskLogListQuery): Promise<Page<TaskLogEntry>> {
    const matching = this.rows
      .filter((log) => (!taskId || log.taskId === taskId) && (!status || log.status === status))
      .reverse();
    const items = matching
      .slice((page - 1) * pageSize, page * pageSize)
      .map((log) => ({ ...log, taskName: this.tasks?.rows.get(log.taskId)?.name ?? 'unknown' }));
    return { items, total: matching.length, page, pageSize };
  }

  async countByStatusSince(since: Date): Promise<Record<TaskLogStatus, number>> {
    const counts = Object.fromEntries(TASK_LOG_STATUSES.map((s) => [s, 0])) as Record<TaskLogStatus, number>;
    for (const log of this.rows) if (log.createdAt >= since) counts[log.status] += 1;
    return counts;
  }
}

import { and, count, desc, eq, getTableColumns, gte, type SQL } from 'drizzle-orm';
import type { Page } from '../../domain/pagination.js';
import { TASK_LOG_STATUSES, type TaskLog, type TaskLogStatus } from '../../domain/task.js';
import type {
  NewTaskLog,
  TaskLogEntry,
  TaskLogListQuery,
  TaskLogRepository,
} from '../../domain/task-log-repository.js';
import type { AnyDatabase } from './client.js';
import { taskLogs, tasks } from './schema.js';

export class DrizzleTaskLogRepository implements TaskLogRepository {
  constructor(private readonly db: AnyDatabase) {}

  async create(log: NewTaskLog): Promise<TaskLog> {
    const [row] = await this.db.insert(taskLogs).values(log).returning();
    if (!row) throw new Error('Insert into task_logs returned no row');
    return row;
  }

  async list({ taskId, status, page, pageSize }: TaskLogListQuery): Promise<Page<TaskLogEntry>> {
    const filters: SQL[] = [];
    if (taskId) filters.push(eq(taskLogs.taskId, taskId));
    if (status) filters.push(eq(taskLogs.status, status));
    const where = and(...filters);

    const [items, total] = await Promise.all([
      this.db
        .select({ ...getTableColumns(taskLogs), taskName: tasks.name })
        .from(taskLogs)
        .innerJoin(tasks, eq(taskLogs.taskId, tasks.id))
        .where(where)
        .orderBy(desc(taskLogs.createdAt), desc(taskLogs.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db.$count(taskLogs, where),
    ]);
    return { items, total, page, pageSize };
  }

  async countByStatusSince(since: Date): Promise<Record<TaskLogStatus, number>> {
    const rows = await this.db
      .select({ status: taskLogs.status, total: count() })
      .from(taskLogs)
      .where(gte(taskLogs.createdAt, since))
      .groupBy(taskLogs.status);
    const counts = Object.fromEntries(TASK_LOG_STATUSES.map((s) => [s, 0])) as Record<TaskLogStatus, number>;
    for (const { status, total } of rows) counts[status] = total;
    return counts;
  }
}

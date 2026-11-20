import { count, desc, eq, ne } from 'drizzle-orm';
import type { Page } from '../../domain/pagination.js';
import { TASK_STATUSES, type Task, type TaskInput, type TaskStatus } from '../../domain/task.js';
import type { TaskChanges, TaskListQuery, TaskRepository } from '../../domain/task-repository.js';
import type { AnyDatabase } from './client.js';
import { tasks, type TaskRow } from './schema.js';

export class DrizzleTaskRepository implements TaskRepository {
  constructor(private readonly db: AnyDatabase) {}

  async create(input: TaskInput & { status: TaskStatus }): Promise<Task> {
    const [row] = await this.db.insert(tasks).values(input).returning();
    if (!row) throw new Error('Insert into tasks returned no row');
    return toTask(row);
  }

  async findById(id: string): Promise<Task | null> {
    const [row] = await this.db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
    return row ? toTask(row) : null;
  }

  async list({ status, page, pageSize }: TaskListQuery): Promise<Page<Task>> {
    const where = status ? eq(tasks.status, status) : undefined;
    const [rows, total] = await Promise.all([
      this.db
        .select()
        .from(tasks)
        .where(where)
        .orderBy(desc(tasks.createdAt), desc(tasks.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db.$count(tasks, where),
    ]);
    return { items: rows.map(toTask), total, page, pageSize };
  }

  async listSchedulable(): Promise<Task[]> {
    const rows = await this.db.select().from(tasks).where(ne(tasks.status, 'paused'));
    return rows.map(toTask);
  }

  async update(id: string, changes: TaskChanges): Promise<Task | null> {
    if (Object.keys(changes).length === 0) return this.findById(id);
    const [row] = await this.db.update(tasks).set(changes).where(eq(tasks.id, id)).returning();
    return row ? toTask(row) : null;
  }

  async delete(id: string): Promise<boolean> {
    const deleted = await this.db.delete(tasks).where(eq(tasks.id, id)).returning({ id: tasks.id });
    return deleted.length > 0;
  }

  async countByStatus(): Promise<Record<TaskStatus, number>> {
    const rows = await this.db.select({ status: tasks.status, total: count() }).from(tasks).groupBy(tasks.status);
    const counts = Object.fromEntries(TASK_STATUSES.map((s) => [s, 0])) as Record<TaskStatus, number>;
    for (const { status, total } of rows) counts[status] = total;
    return counts;
  }
}

function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    name: row.name,
    cronSchedule: row.cronSchedule,
    timezone: row.timezone,
    webhookUrl: row.webhookUrl,
    payload: row.payload,
    maxRetry: row.maxRetry,
    retryDelayMs: row.retryDelayMs,
    status: row.status,
    lastRunAt: row.lastRunAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

import { randomUUID } from 'node:crypto';
import type { Page } from '../../src/domain/pagination.js';
import { TASK_STATUSES, type Task, type TaskInput, type TaskStatus } from '../../src/domain/task.js';
import type { TaskChanges, TaskListQuery, TaskRepository } from '../../src/domain/task-repository.js';

/** Behaves like the Drizzle repository: newest first, `updatedAt` refreshed on update. */
export class InMemoryTaskRepository implements TaskRepository {
  readonly rows = new Map<string, Task>();
  private clock = Date.parse('2026-01-01T00:00:00Z');

  private now(): Date {
    this.clock += 1000;
    return new Date(this.clock);
  }

  async create(input: TaskInput & { status: TaskStatus }): Promise<Task> {
    const now = this.now();
    const task: Task = { ...input, id: randomUUID(), lastRunAt: null, createdAt: now, updatedAt: now };
    this.rows.set(task.id, task);
    return { ...task };
  }

  async findById(id: string): Promise<Task | null> {
    const task = this.rows.get(id);
    return task ? { ...task } : null;
  }

  async list({ status, page, pageSize }: TaskListQuery): Promise<Page<Task>> {
    const matching = [...this.rows.values()]
      .filter((task) => !status || task.status === status)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const items = matching.slice((page - 1) * pageSize, page * pageSize).map((task) => ({ ...task }));
    return { items, total: matching.length, page, pageSize };
  }

  async update(id: string, changes: TaskChanges): Promise<Task | null> {
    const task = this.rows.get(id);
    if (!task) return null;
    const updated = { ...task, ...changes, updatedAt: this.now() };
    this.rows.set(id, updated);
    return { ...updated };
  }

  async delete(id: string): Promise<boolean> {
    return this.rows.delete(id);
  }

  async countByStatus(): Promise<Record<TaskStatus, number>> {
    const counts = Object.fromEntries(TASK_STATUSES.map((s) => [s, 0])) as Record<TaskStatus, number>;
    for (const task of this.rows.values()) counts[task.status] += 1;
    return counts;
  }
}

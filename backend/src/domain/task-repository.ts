import type { Page, PageQuery } from './pagination.js';
import type { Task, TaskInput, TaskStatus } from './task.js';

export interface TaskListQuery extends PageQuery {
  status?: TaskStatus;
}

export type TaskChanges = Partial<TaskInput & Pick<Task, 'status' | 'lastRunAt'>>;

export interface TaskRepository {
  create(input: TaskInput & { status: TaskStatus }): Promise<Task>;
  findById(id: string): Promise<Task | null>;
  list(query: TaskListQuery): Promise<Page<Task>>;
  /** Returns the updated task, or null when it does not exist. */
  update(id: string, changes: TaskChanges): Promise<Task | null>;
  /** Returns false when the task does not exist. */
  delete(id: string): Promise<boolean>;
  countByStatus(): Promise<Record<TaskStatus, number>>;
}

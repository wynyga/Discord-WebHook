import type { Page } from '../../domain/pagination.js';
import type { TaskLogEntry, TaskLogListQuery, TaskLogRepository } from '../../domain/task-log-repository.js';
import type { TaskRepository } from '../../domain/task-repository.js';
import { findTaskOrThrow } from '../tasks/find-task.js';

export class ListLogs {
  constructor(
    private readonly logs: TaskLogRepository,
    private readonly tasks: TaskRepository,
  ) {}

  /** When filtering by task, an unknown task is a 404 rather than an empty page. */
  async execute(query: TaskLogListQuery): Promise<Page<TaskLogEntry>> {
    if (query.taskId) await findTaskOrThrow(this.tasks, query.taskId);
    return this.logs.list(query);
  }
}

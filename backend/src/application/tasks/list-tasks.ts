import type { Page } from '../../domain/pagination.js';
import type { Task } from '../../domain/task.js';
import type { TaskListQuery, TaskRepository } from '../../domain/task-repository.js';

export class ListTasks {
  constructor(private readonly tasks: TaskRepository) {}

  execute(query: TaskListQuery): Promise<Page<Task>> {
    return this.tasks.list(query);
  }
}

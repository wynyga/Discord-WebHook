import type { Task } from '../../domain/task.js';
import type { TaskRepository } from '../../domain/task-repository.js';
import { findTaskOrThrow } from './find-task.js';

export class GetTask {
  constructor(private readonly tasks: TaskRepository) {}

  execute(id: string): Promise<Task> {
    return findTaskOrThrow(this.tasks, id);
  }
}

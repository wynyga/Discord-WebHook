import { assertRetryWindowFits } from '../../domain/schedule.js';
import type { SchedulerPort } from '../../domain/scheduler.js';
import type { Task, TaskInput } from '../../domain/task.js';
import type { TaskRepository } from '../../domain/task-repository.js';

export class CreateTask {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly scheduler: SchedulerPort,
  ) {}

  async execute(input: TaskInput): Promise<Task> {
    assertRetryWindowFits(input);
    const task = await this.tasks.create({ ...input, status: 'active' });
    try {
      await this.scheduler.upsert(task);
    } catch (err) {
      // A task without a schedule would look active but never run.
      await this.tasks.delete(task.id);
      throw err;
    }
    return task;
  }
}

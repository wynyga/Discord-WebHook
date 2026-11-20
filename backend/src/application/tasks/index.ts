import type { SchedulerPort } from '../../domain/scheduler.js';
import type { TaskRepository } from '../../domain/task-repository.js';
import { CreateTask } from './create-task.js';
import { DeleteTask } from './delete-task.js';
import { GetTask } from './get-task.js';
import { ListTasks } from './list-tasks.js';
import { PauseTask } from './pause-task.js';
import { ResumeTask } from './resume-task.js';
import { UpdateTask } from './update-task.js';

export { CreateTask, DeleteTask, GetTask, ListTasks, PauseTask, ResumeTask, UpdateTask };
export type { TaskUpdate } from './update-task.js';

export interface TaskUseCases {
  create: CreateTask;
  update: UpdateTask;
  delete: DeleteTask;
  get: GetTask;
  list: ListTasks;
  pause: PauseTask;
  resume: ResumeTask;
}

export function createTaskUseCases(tasks: TaskRepository, scheduler: SchedulerPort): TaskUseCases {
  return {
    create: new CreateTask(tasks, scheduler),
    update: new UpdateTask(tasks, scheduler),
    delete: new DeleteTask(tasks, scheduler),
    get: new GetTask(tasks),
    list: new ListTasks(tasks),
    pause: new PauseTask(tasks, scheduler),
    resume: new ResumeTask(tasks, scheduler),
  };
}

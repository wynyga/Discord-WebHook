import type { JobsOptions } from 'bullmq';
import type { ExecutionTrigger } from '../../domain/execution.js';
import type { Task } from '../../domain/task.js';

/** Contract shared by the scheduler (producer) and the worker (consumer). */
export const TASK_QUEUE_NAME = 'task-executions';
export const EXECUTE_JOB_NAME = 'execute-task';
/** Custom backoff type; see `taskBackoffStrategy`. */
export const TASK_BACKOFF_TYPE = 'task-delay';

const SCHEDULER_PREFIX = 'task:';

export interface TaskJobData {
  taskId: string;
  trigger: ExecutionTrigger;
}

export function schedulerIdFor(taskId: string): string {
  return `${SCHEDULER_PREFIX}${taskId}`;
}

export function taskIdFromSchedulerId(schedulerId: string): string | null {
  return schedulerId.startsWith(SCHEDULER_PREFIX) ? schedulerId.slice(SCHEDULER_PREFIX.length) : null;
}

/** Retry policy is copied into every job, so a run keeps the policy it started with. */
export function jobOptionsFor(task: Pick<Task, 'maxRetry' | 'retryDelayMs'>) {
  return {
    attempts: task.maxRetry + 1,
    backoff: { type: TASK_BACKOFF_TYPE, delay: task.retryDelayMs },
    // Results live in task_logs; Redis only keeps a short history for debugging.
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 500 },
  } satisfies JobsOptions;
}

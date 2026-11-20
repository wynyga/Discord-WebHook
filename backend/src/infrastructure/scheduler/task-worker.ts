import { UnrecoverableError, Worker, type BackoffStrategy, type ConnectionOptions, type Job } from 'bullmq';
import type { ExecutionHandler, ExecutionResult } from '../../domain/execution.js';
import type { Logger } from '../logger.js';
import { TASK_QUEUE_NAME, type TaskJobData } from './task-queue.js';

/** Thrown to make BullMQ retry; carries Discord's requested wait, if any. */
export class RetryLaterError extends Error {
  override readonly name = 'RetryLaterError';

  constructor(readonly retryAfterMs?: number) {
    super('Execution failed, retry scheduled');
  }
}

type TaskJob = Pick<Job<TaskJobData>, 'data' | 'attemptsMade' | 'opts'>;

/** Runs one attempt and turns the outcome into what BullMQ understands: return, retry or stop. */
export async function processTaskJob(job: TaskJob, handler: ExecutionHandler): Promise<ExecutionResult> {
  const result = await handler({
    taskId: job.data.taskId,
    trigger: job.data.trigger,
    attempt: job.attemptsMade,
    maxRetries: Math.max(0, (job.opts.attempts ?? 1) - 1),
  });
  if (result.outcome === 'retry') throw new RetryLaterError(result.retryAfterMs);
  if (result.outcome === 'failed') throw new UnrecoverableError('Execution failed, no retries left');
  return result;
}

/** Waits the task's `retryDelayMs`, or longer when Discord rate limited us. */
export const taskBackoffStrategy: BackoffStrategy = (_attemptsMade, _type, err, job) => {
  const backoff = job?.opts.backoff;
  const delay = typeof backoff === 'object' ? (backoff.delay ?? 0) : (backoff ?? 0);
  const retryAfter = err instanceof RetryLaterError ? (err.retryAfterMs ?? 0) : 0;
  return Math.max(delay, retryAfter);
};

export class TaskWorker {
  private readonly worker: Worker<TaskJobData, ExecutionResult>;

  constructor(connection: ConnectionOptions, handler: ExecutionHandler, logger: Logger, concurrency: number) {
    this.worker = new Worker<TaskJobData, ExecutionResult>(TASK_QUEUE_NAME, (job) => processTaskJob(job, handler), {
      connection,
      concurrency,
      autorun: false,
      settings: { backoffStrategy: taskBackoffStrategy },
    });

    this.worker.on('completed', (job, result) => {
      logger.info({ taskId: job.data.taskId, trigger: job.data.trigger, outcome: result.outcome }, 'Task run finished');
    });
    this.worker.on('failed', (job, err) => {
      const context = { taskId: job?.data.taskId, attemptsMade: job?.attemptsMade };
      if (err instanceof RetryLaterError) logger.warn(context, 'Task attempt failed, retry scheduled');
      else if (err instanceof UnrecoverableError) logger.warn(context, 'Task run failed');
      else logger.error({ ...context, err }, 'Task run crashed');
    });
    this.worker.on('error', (err) => logger.error({ err }, 'Worker error'));
  }

  start(): void {
    void this.worker.run();
  }

  /** Waits for running jobs to finish. */
  close(): Promise<void> {
    return this.worker.close();
  }
}

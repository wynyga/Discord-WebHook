import { DiscordDeliveryError, type DiscordPort } from '../../domain/discord.js';
import type { ExecutionRequest, ExecutionResult } from '../../domain/execution.js';
import { renderTemplate, templateValues } from '../../domain/payload-template.js';
import type { Task } from '../../domain/task.js';
import type { TaskLogRepository } from '../../domain/task-log-repository.js';
import type { TaskRepository } from '../../domain/task-repository.js';

const MAX_MESSAGE_LENGTH = 1000;

/**
 * One attempt of one run: send the stored payload, write a log row, update the task status.
 * Returns what the queue should do next instead of throwing, so retry policy stays visible here.
 */
export class ExecuteTask {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly logs: TaskLogRepository,
    private readonly discord: DiscordPort,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    const task = await this.tasks.findById(request.taskId);
    if (!task) return { outcome: 'skipped', reason: 'Task no longer exists' };
    // The schedule is removed on pause, but a job may already be queued.
    if (request.trigger === 'schedule' && task.status === 'paused') {
      return { outcome: 'skipped', reason: 'Task is paused' };
    }

    const executedAt = this.now();
    try {
      // The stored payload is a template; each attempt sends its own run's values.
      const payload = renderTemplate(task.payload, templateValues(task, executedAt, request.attempt + 1));
      const delivery = await this.discord.send(task.webhookUrl, payload);
      await this.logs.create({
        taskId: task.id,
        executedAt,
        status: 'success',
        retryCount: request.attempt,
        httpStatus: delivery.httpStatus,
        durationMs: delivery.durationMs,
        message: `Delivered to Discord (HTTP ${delivery.httpStatus})`,
      });
      // A success heals a task that failed earlier.
      await this.tasks.update(task.id, { lastRunAt: executedAt, ...statusAfter(task, 'success') });
      return { outcome: 'success' };
    } catch (err) {
      if (!(err instanceof DiscordDeliveryError)) throw err;

      const final = !err.retryable || request.attempt >= request.maxRetries;
      await this.logs.create({
        taskId: task.id,
        executedAt,
        status: final ? 'failed' : 'retrying',
        retryCount: request.attempt,
        httpStatus: err.httpStatus,
        durationMs: err.durationMs,
        message: describeFailure(err, request, final),
      });
      await this.tasks.update(task.id, { lastRunAt: executedAt, ...statusAfter(task, final ? 'failed' : 'retry') });

      if (final) return { outcome: 'failed' };
      return err.retryAfterMs === undefined ? { outcome: 'retry' } : { outcome: 'retry', retryAfterMs: err.retryAfterMs };
    }
  }
}

/** Paused stays paused (manual runs); otherwise success means active and a final failure means failed. */
function statusAfter(task: Task, result: 'success' | 'retry' | 'failed'): Partial<Pick<Task, 'status'>> {
  if (task.status === 'paused' || result === 'retry') return {};
  const status = result === 'success' ? 'active' : 'failed';
  return status === task.status ? {} : { status };
}

function describeFailure(err: DiscordDeliveryError, request: ExecutionRequest, final: boolean): string {
  let suffix: string;
  if (!err.retryable) suffix = 'Not retryable';
  else if (final) suffix = `Gave up after ${request.maxRetries} ${request.maxRetries === 1 ? 'retry' : 'retries'}`;
  else suffix = `Retry ${request.attempt + 1} of ${request.maxRetries} scheduled`;
  return `${err.message}. ${suffix}`.slice(0, MAX_MESSAGE_LENGTH);
}

/** `schedule` comes from the cron scheduler, `manual` from "run now". */
export type ExecutionTrigger = 'schedule' | 'manual';

export interface ExecutionRequest {
  taskId: string;
  trigger: ExecutionTrigger;
  /** 0 for the first attempt, 1 for the first retry, and so on. */
  attempt: number;
  /** Retries allowed for this run, fixed when the run was queued. */
  maxRetries: number;
}

export type ExecutionResult =
  | { outcome: 'success' }
  | { outcome: 'skipped'; reason: string }
  /** Try again; `retryAfterMs` overrides the task's delay when Discord asks for a longer wait. */
  | { outcome: 'retry'; retryAfterMs?: number }
  /** Stop: retries are exhausted or the error cannot be fixed by retrying. */
  | { outcome: 'failed' };

export type ExecutionHandler = (request: ExecutionRequest) => Promise<ExecutionResult>;

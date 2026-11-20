import type { TaskLogEntry } from '../../../domain/task-log-repository.js';

export function toLogResponse(log: TaskLogEntry) {
  return {
    id: log.id,
    taskId: log.taskId,
    taskName: log.taskName,
    executedAt: log.executedAt.toISOString(),
    status: log.status,
    retryCount: log.retryCount,
    httpStatus: log.httpStatus,
    durationMs: log.durationMs,
    message: log.message,
    createdAt: log.createdAt.toISOString(),
  };
}

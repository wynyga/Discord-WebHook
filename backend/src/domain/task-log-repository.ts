import type { Page, PageQuery } from './pagination.js';
import type { TaskLog, TaskLogStatus } from './task.js';

export type NewTaskLog = Omit<TaskLog, 'id' | 'createdAt'>;

/** A log row with the name of its task, for the log viewer. */
export interface TaskLogEntry extends TaskLog {
  taskName: string;
}

export interface TaskLogListQuery extends PageQuery {
  taskId?: string;
  status?: TaskLogStatus;
}

export interface TaskLogRepository {
  create(log: NewTaskLog): Promise<TaskLog>;
  /** Newest first. */
  list(query: TaskLogListQuery): Promise<Page<TaskLogEntry>>;
  countByStatusSince(since: Date): Promise<Record<TaskLogStatus, number>>;
  /** Attempts per started hour (UTC) and status since `since`; hours without attempts are absent. */
  countByHourSince(since: Date): Promise<HourlyCount[]>;
}

export interface HourlyCount {
  hour: Date;
  status: TaskLogStatus;
  count: number;
}

import type { TaskLogStatus, TaskStatus } from '../../domain/task.js';
import type { HourlyCount, TaskLogRepository } from '../../domain/task-log-repository.js';
import type { TaskRepository } from '../../domain/task-repository.js';

const HOUR_MS = 60 * 60 * 1000;
const HOURS = 24;

export interface HourlyActivity extends Record<TaskLogStatus, number> {
  /** Start of the hour (UTC). */
  hour: Date;
}

export interface DashboardSummary {
  tasks: Record<TaskStatus, number> & { total: number };
  /** Attempts logged in the last 24 hours, by outcome. */
  executions24h: Record<TaskLogStatus, number> & { total: number };
  /** The same 24 hours split per hour, oldest first, current hour last; empty hours are zeros. */
  activity24h: HourlyActivity[];
}

export class GetDashboardSummary {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly logs: TaskLogRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(): Promise<DashboardSummary> {
    const now = this.now();
    const currentHour = Math.floor(now.getTime() / HOUR_MS) * HOUR_MS;
    const firstHour = currentHour - (HOURS - 1) * HOUR_MS;
    const since = new Date(now.getTime() - HOURS * HOUR_MS);

    const [taskCounts, logCounts, hourly] = await Promise.all([
      this.tasks.countByStatus(),
      this.logs.countByStatusSince(since),
      this.logs.countByHourSince(new Date(firstHour)),
    ]);
    return {
      tasks: { ...taskCounts, total: sum(taskCounts) },
      executions24h: { ...logCounts, total: sum(logCounts) },
      activity24h: fillHours(hourly, firstHour),
    };
  }
}

function fillHours(rows: HourlyCount[], firstHour: number): HourlyActivity[] {
  const buckets = Array.from({ length: HOURS }, (_, i) => ({
    hour: new Date(firstHour + i * HOUR_MS),
    success: 0,
    retrying: 0,
    failed: 0,
  }));
  for (const row of rows) {
    const index = Math.round((row.hour.getTime() - firstHour) / HOUR_MS);
    const bucket = buckets[index];
    if (bucket) bucket[row.status] += row.count;
  }
  return buckets;
}

function sum(counts: Record<string, number>): number {
  return Object.values(counts).reduce((total, n) => total + n, 0);
}

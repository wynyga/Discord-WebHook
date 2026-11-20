import type { TaskLogStatus, TaskStatus } from '../../domain/task.js';
import type { TaskLogRepository } from '../../domain/task-log-repository.js';
import type { TaskRepository } from '../../domain/task-repository.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface DashboardSummary {
  tasks: Record<TaskStatus, number> & { total: number };
  /** Attempts logged in the last 24 hours, by outcome. */
  executions24h: Record<TaskLogStatus, number> & { total: number };
}

export class GetDashboardSummary {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly logs: TaskLogRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(): Promise<DashboardSummary> {
    const since = new Date(this.now().getTime() - DAY_MS);
    const [taskCounts, logCounts] = await Promise.all([
      this.tasks.countByStatus(),
      this.logs.countByStatusSince(since),
    ]);
    return {
      tasks: { ...taskCounts, total: sum(taskCounts) },
      executions24h: { ...logCounts, total: sum(logCounts) },
    };
  }
}

function sum(counts: Record<string, number>): number {
  return Object.values(counts).reduce((total, n) => total + n, 0);
}

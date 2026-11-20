import { vi } from 'vitest';
import type { SchedulerPort } from '../../src/domain/scheduler.js';
import type { Task } from '../../src/domain/task.js';

export function fakeScheduler() {
  return {
    upsert: vi.fn<(task: Task) => Promise<void>>().mockResolvedValue(undefined),
    remove: vi.fn<(taskId: string) => Promise<void>>().mockResolvedValue(undefined),
    runNow: vi.fn<(task: Task) => Promise<void>>().mockResolvedValue(undefined),
    scheduledTaskIds: vi.fn<() => Promise<string[]>>().mockResolvedValue([]),
  } satisfies SchedulerPort;
}

export type FakeScheduler = ReturnType<typeof fakeScheduler>;

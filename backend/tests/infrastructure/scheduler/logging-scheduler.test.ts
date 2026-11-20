import { describe, expect, it, vi } from 'vitest';
import type { Task } from '../../../src/domain/task.js';
import { LoggingScheduler } from '../../../src/infrastructure/scheduler/logging-scheduler.js';
import { silentLogger } from '../../helpers/logger.js';

describe('LoggingScheduler', () => {
  it('only logs a warning for every operation', async () => {
    const logger = silentLogger();
    const warn = vi.spyOn(logger, 'warn');
    const scheduler = new LoggingScheduler(logger);
    const task = { id: 'task-1', cronSchedule: '* * * * *' } as Task;

    await scheduler.upsert(task);
    await scheduler.remove('task-1');
    await scheduler.runNow(task);

    expect(warn).toHaveBeenCalledTimes(3);
  });
});

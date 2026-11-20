import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { createDatabase } from '../../../src/infrastructure/database/client.js';

function fakePool() {
  return {
    query: vi.fn().mockResolvedValue({ rows: [], fields: [], rowCount: 0 }),
    end: vi.fn().mockResolvedValue(undefined),
  };
}

describe('createDatabase', () => {
  it('pings with SELECT 1', async () => {
    const pool = fakePool();
    const { ping } = createDatabase('postgres://unused', pool as unknown as Pool);

    await ping();

    expect(pool.query).toHaveBeenCalledOnce();
    expect(JSON.stringify(pool.query.mock.calls[0])).toContain('SELECT 1');
  });

  it('rejects the ping when Postgres is down', async () => {
    const pool = fakePool();
    pool.query.mockRejectedValue(new Error('ECONNREFUSED'));
    const { ping } = createDatabase('postgres://unused', pool as unknown as Pool);

    await expect(ping()).rejects.toThrow();
  });

  it('closes the pool', async () => {
    const pool = fakePool();
    const { close } = createDatabase('postgres://unused', pool as unknown as Pool);

    await close();

    expect(pool.end).toHaveBeenCalledOnce();
  });
});

import { describe, expect, it, vi } from 'vitest';
import type { Database } from '../../../src/infrastructure/database/client.js';
import { MIGRATIONS_FOLDER, runMigrations } from '../../../src/infrastructure/database/migrate.js';
import { silentLogger } from '../../helpers/logger.js';

const migrate = vi.hoisted(() => vi.fn());
vi.mock('drizzle-orm/node-postgres/migrator', () => ({ migrate }));

describe('runMigrations', () => {
  const db = {} as Database;

  it('applies migrations from the drizzle folder by default', async () => {
    migrate.mockResolvedValue(undefined);

    await runMigrations(db, silentLogger());

    expect(migrate).toHaveBeenCalledWith(db, { migrationsFolder: MIGRATIONS_FOLDER });
    expect(MIGRATIONS_FOLDER.replaceAll('\\', '/')).toMatch(/backend\/drizzle$/);
  });

  it('propagates failures so boot stops', async () => {
    migrate.mockRejectedValue(new Error('relation already exists'));

    await expect(runMigrations(db, silentLogger(), '/tmp/migrations')).rejects.toThrow('relation already exists');
  });
});

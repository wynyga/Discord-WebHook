import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import type { AnyDatabase } from '../../src/infrastructure/database/client.js';
import { MIGRATIONS_FOLDER } from '../../src/infrastructure/database/migrate.js';
import * as schema from '../../src/infrastructure/database/schema.js';

/** In-process Postgres with the real committed migrations applied. */
export async function createTestDatabase() {
  const client = new PGlite();
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

  return {
    db: db as unknown as AnyDatabase,
    reset: async () => {
      await db.delete(schema.tasks);
    },
    close: () => client.close(),
  };
}

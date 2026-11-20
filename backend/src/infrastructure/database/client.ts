import { sql } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { Pool } from 'pg';
import * as schema from './schema.js';

export type Database = NodePgDatabase<typeof schema>;

/** Driver-agnostic handle used by repositories, so tests can run them on PGlite. */
export type AnyDatabase = PgDatabase<PgQueryResultHKT, typeof schema>;

export interface DatabaseConnection {
  db: Database;
  /** Rejects when Postgres is unreachable; used by `/health`. */
  ping: () => Promise<void>;
  close: () => Promise<void>;
}

export function createDatabase(url: string, pool: Pool = new Pool({ connectionString: url, max: 10 })): DatabaseConnection {
  const db = drizzle({ client: pool, schema });

  return {
    db,
    ping: async () => {
      await db.execute(sql`SELECT 1`);
    },
    close: () => pool.end(),
  };
}

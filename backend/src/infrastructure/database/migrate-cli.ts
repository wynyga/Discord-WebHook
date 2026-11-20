import { createLogger } from '../logger.js';
import { createDatabase } from './client.js';
import { runMigrations } from './migrate.js';

/** `npm run db:migrate`: applies migrations without starting the API. */
const url = process.env.DATABASE_URL;
const logger = createLogger({ logLevel: 'info', nodeEnv: 'production' });

if (!url) {
  logger.fatal('DATABASE_URL is not set');
  process.exit(1);
}

const connection = createDatabase(url);
try {
  await runMigrations(connection.db, logger);
} catch (err) {
  logger.fatal({ err }, 'Migration failed');
  process.exitCode = 1;
} finally {
  await connection.close();
}

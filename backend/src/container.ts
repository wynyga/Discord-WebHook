import { Login } from './application/auth/login.js';
import { createTaskUseCases } from './application/tasks/index.js';
import type { Config } from './config/env.js';
import { EnvCredentialsVerifier } from './infrastructure/auth/env-credentials-verifier.js';
import { JwtTokenService } from './infrastructure/auth/jwt-token-service.js';
import { createDatabase } from './infrastructure/database/client.js';
import { runMigrations } from './infrastructure/database/migrate.js';
import { DrizzleTaskRepository } from './infrastructure/database/task-repository.js';
import type { Logger } from './infrastructure/logger.js';
import { LoggingScheduler } from './infrastructure/scheduler/logging-scheduler.js';
import type { AppDependencies } from './presentation/http/app.js';

export interface Container {
  app: AppDependencies;
  /** Run in order on shutdown. */
  closers: Array<() => Promise<void>>;
}

/** Composition root: the only place that knows which adapter backs each port. */
export async function buildContainer(config: Config, logger: Logger): Promise<Container> {
  const database = createDatabase(config.databaseUrl);
  await runMigrations(database.db, logger);

  const taskRepository = new DrizzleTaskRepository(database.db);
  const scheduler = new LoggingScheduler(logger);
  const tokens = new JwtTokenService(config.jwt.secret, config.jwt.expiresIn);

  return {
    app: {
      logger,
      corsOrigin: config.corsOrigin,
      healthChecks: { database: database.ping },
      login: new Login(new EnvCredentialsVerifier(config.admin), tokens),
      tokens,
      tasks: createTaskUseCases(taskRepository, scheduler),
    },
    closers: [database.close],
  };
}

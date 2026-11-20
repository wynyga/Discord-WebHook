import { Queue } from 'bullmq';
import { Login } from './application/auth/login.js';
import { GetDashboardSummary } from './application/dashboard/get-dashboard-summary.js';
import { ListLogs } from './application/logs/list-logs.js';
import { createTaskUseCases, ExecuteTask, ReconcileSchedules } from './application/tasks/index.js';
import type { Config } from './config/env.js';
import { EnvCredentialsVerifier } from './infrastructure/auth/env-credentials-verifier.js';
import { JwtTokenService } from './infrastructure/auth/jwt-token-service.js';
import { createDatabase } from './infrastructure/database/client.js';
import { runMigrations } from './infrastructure/database/migrate.js';
import { DrizzleTaskLogRepository } from './infrastructure/database/task-log-repository.js';
import { DrizzleTaskRepository } from './infrastructure/database/task-repository.js';
import { DiscordWebhookClient } from './infrastructure/discord/discord-webhook-client.js';
import type { Logger } from './infrastructure/logger.js';
import { createRedisConnection } from './infrastructure/redis.js';
import { BullMqScheduler } from './infrastructure/scheduler/bullmq-scheduler.js';
import { TASK_QUEUE_NAME, type TaskJobData } from './infrastructure/scheduler/task-queue.js';
import { TaskWorker } from './infrastructure/scheduler/task-worker.js';
import type { AppDependencies } from './presentation/http/app.js';

export interface Container {
  app: AppDependencies;
  /** Run in order on shutdown: stop taking work first, close connections last. */
  closers: Array<() => Promise<void>>;
}

/** Composition root: the only place that knows which adapter backs each port. */
export async function buildContainer(config: Config, logger: Logger): Promise<Container> {
  const database = createDatabase(config.databaseUrl);
  await runMigrations(database.db, logger);

  const redis = createRedisConnection(config.redisUrl);
  const queue = new Queue<TaskJobData>(TASK_QUEUE_NAME, { connection: redis.client });

  const taskRepository = new DrizzleTaskRepository(database.db);
  const logRepository = new DrizzleTaskLogRepository(database.db);
  const scheduler = new BullMqScheduler(queue);
  const discord = new DiscordWebhookClient({ timeoutMs: config.discordTimeoutMs });
  const tokens = new JwtTokenService(config.jwt.secret, config.jwt.expiresIn);

  // Database is the source of truth; bring Redis schedules in line before taking work.
  const reconciled = await new ReconcileSchedules(taskRepository, scheduler).execute();
  logger.info(reconciled, 'Schedules reconciled');

  const executeTask = new ExecuteTask(taskRepository, logRepository, discord);
  const worker = new TaskWorker(redis.client, (request) => executeTask.execute(request), logger, config.workerConcurrency);
  worker.start();

  return {
    app: {
      logger,
      corsOrigin: config.corsOrigin,
      healthChecks: { database: database.ping, redis: redis.ping },
      login: new Login(new EnvCredentialsVerifier(config.admin), tokens),
      tokens,
      tasks: createTaskUseCases(taskRepository, scheduler),
      listLogs: new ListLogs(logRepository, taskRepository),
      dashboardSummary: new GetDashboardSummary(taskRepository, logRepository),
    },
    closers: [() => worker.close(), () => queue.close(), redis.close, database.close],
  };
}

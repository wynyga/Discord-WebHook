import { Login } from '../../src/application/auth/login.js';
import { GetDashboardSummary } from '../../src/application/dashboard/get-dashboard-summary.js';
import { ListLogs } from '../../src/application/logs/list-logs.js';
import { createTaskUseCases } from '../../src/application/tasks/index.js';
import { EnvCredentialsVerifier } from '../../src/infrastructure/auth/env-credentials-verifier.js';
import { JwtTokenService } from '../../src/infrastructure/auth/jwt-token-service.js';
import { createApp, type AppDependencies } from '../../src/presentation/http/app.js';
import { fakeScheduler } from '../fakes/fake-scheduler.js';
import { InMemoryTaskLogRepository } from '../fakes/in-memory-task-log-repository.js';
import { InMemoryTaskRepository } from '../fakes/in-memory-task-repository.js';
import { silentLogger } from './logger.js';

export const TEST_ADMIN = { username: 'admin', password: 'correct-horse' };
export const TEST_JWT_SECRET = 'test-secret-that-is-at-least-32-characters';

/** Real HTTP stack, auth and use cases; only the database and scheduler are faked. */
export function buildTestApp(overrides: Partial<AppDependencies> = {}) {
  const repository = new InMemoryTaskRepository();
  const logRepository = new InMemoryTaskLogRepository(repository);
  const scheduler = fakeScheduler();
  const tokens = new JwtTokenService(TEST_JWT_SECRET, '1h');

  const app = createApp({
    logger: silentLogger(),
    corsOrigin: ['http://localhost:5173'],
    healthChecks: {},
    login: new Login(new EnvCredentialsVerifier(TEST_ADMIN), tokens),
    tokens,
    tasks: createTaskUseCases(repository, scheduler),
    listLogs: new ListLogs(logRepository, repository),
    dashboardSummary: new GetDashboardSummary(repository, logRepository),
    ...overrides,
  });

  const authHeader = async () => `Bearer ${(await tokens.issue(TEST_ADMIN.username)).token}`;

  return { app, repository, logRepository, scheduler, tokens, authHeader };
}

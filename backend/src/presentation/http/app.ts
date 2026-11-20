import cors from 'cors';
import express, { Router, type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import type { Login } from '../../application/auth/login.js';
import type { TaskUseCases } from '../../application/tasks/index.js';
import type { TokenService } from '../../domain/auth.js';
import type { Logger } from '../../infrastructure/logger.js';
import { requireAuth } from './middleware/auth.js';
import { createErrorHandler, notFoundHandler } from './middleware/error-handler.js';
import { createAuthRouter, type LoginRateLimit } from './routes/auth.js';
import { createHealthRouter, type HealthCheck } from './routes/health.js';
import { createTasksRouter } from './routes/tasks.js';

export interface AppDependencies {
  logger: Logger;
  corsOrigin: string[];
  healthChecks: Record<string, HealthCheck>;
  login: Login;
  tokens: TokenService;
  tasks: TaskUseCases;
  loginRateLimit?: LoginRateLimit;
}

const DEFAULT_LOGIN_RATE_LIMIT: LoginRateLimit = { windowMs: 15 * 60_000, limit: 10 };

export function createApp(deps: AppDependencies): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: deps.corsOrigin }));
  app.use(express.json({ limit: '100kb' }));
  app.use(pinoHttp({ logger: deps.logger, autoLogging: { ignore: (req) => req.url === '/health' } }));

  // Public
  app.use(createHealthRouter(deps.healthChecks));
  app.use(createAuthRouter(deps.login, deps.loginRateLimit ?? DEFAULT_LOGIN_RATE_LIMIT));

  // Everything below needs a valid token, including unknown routes, so the API surface is not
  // discoverable without one.
  const api = Router();
  api.use(requireAuth(deps.tokens));
  api.use(createTasksRouter(deps.tasks));
  app.use(api);

  app.use(notFoundHandler);
  app.use(createErrorHandler(deps.logger));

  return app;
}

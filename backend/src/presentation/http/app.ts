import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import type { Logger } from '../../infrastructure/logger.js';
import { createErrorHandler, notFoundHandler } from './middleware/error-handler.js';
import { createHealthRouter, type HealthCheck } from './routes/health.js';

export interface AppDependencies {
  logger: Logger;
  corsOrigin: string[];
  healthChecks: Record<string, HealthCheck>;
}

export function createApp(deps: AppDependencies): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: deps.corsOrigin }));
  app.use(express.json({ limit: '100kb' }));
  app.use(pinoHttp({ logger: deps.logger, autoLogging: { ignore: (req) => req.url === '/health' } }));

  app.use(createHealthRouter(deps.healthChecks));

  app.use(notFoundHandler);
  app.use(createErrorHandler(deps.logger));

  return app;
}

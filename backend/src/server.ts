import type { Server } from 'node:http';
import { loadConfig } from './config/env.js';
import { createLogger } from './infrastructure/logger.js';
import { createApp } from './presentation/http/app.js';

const SHUTDOWN_TIMEOUT_MS = 10_000;

function main(): void {
  const config = loadConfig();
  const logger = createLogger(config);

  const app = createApp({
    logger,
    corsOrigin: config.corsOrigin,
    healthChecks: {},
  });

  const server = app.listen(config.port, () => {
    logger.info({ port: config.port }, 'API listening');
  });

  registerShutdown(server, logger);
}

function registerShutdown(server: Server, logger: ReturnType<typeof createLogger>): void {
  let shuttingDown = false;

  const shutdown = (signal: NodeJS.Signals) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Shutting down');

    const timer = setTimeout(() => {
      logger.error('Shutdown timed out, forcing exit');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    timer.unref();

    server.close((err) => {
      if (err) {
        logger.error({ err }, 'Error while closing HTTP server');
        process.exit(1);
      }
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

try {
  main();
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}

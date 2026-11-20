import type { Server } from 'node:http';
import { loadConfig } from './config/env.js';
import { buildContainer } from './container.js';
import { createLogger, type Logger } from './infrastructure/logger.js';
import { createApp } from './presentation/http/app.js';

const SHUTDOWN_TIMEOUT_MS = 10_000;

type Closer = () => Promise<void>;

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(config);

  const container = await buildContainer(config, logger);
  const app = createApp(container.app);

  const server = app.listen(config.port, () => {
    logger.info({ port: config.port }, 'API listening');
  });

  registerShutdown(server, logger, container.closers);
}

/** Stops accepting requests, then closes resources in order. */
function registerShutdown(server: Server, logger: Logger, closers: Closer[]): void {
  let shuttingDown = false;

  const shutdown = async (signal: NodeJS.Signals) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Shutting down');

    const timer = setTimeout(() => {
      logger.error('Shutdown timed out, forcing exit');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    timer.unref();

    try {
      await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
      for (const close of closers) await close();
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err: unknown) => {
  console.error(describeStartupError(err));
  process.exit(1);
});

/** Includes the cause chain: a failed migration only says "Failed query", the cause says why. */
function describeStartupError(err: unknown): string {
  const lines: string[] = [];
  let current: unknown = err;
  while (current instanceof Error && lines.length < 5) {
    lines.push(lines.length === 0 ? current.message : `Caused by: ${current.message}`);
    current = current.cause;
  }
  return lines.length > 0 ? lines.join('\n') : String(err);
}

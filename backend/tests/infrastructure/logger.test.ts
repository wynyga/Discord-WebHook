import { pino } from 'pino';
import { describe, expect, it } from 'vitest';
import { createLogger, type Logger } from '../../src/infrastructure/logger.js';

/** The destination pino writes to; a transport (pino-pretty) shows up as a worker-thread stream. */
const streamOf = (logger: Logger) => (logger as unknown as Record<symbol, { constructor: { name: string } }>)[pino.symbols.streamSym];

describe('createLogger', () => {
  it('uses the configured level', () => {
    const logger = createLogger({ logLevel: 'warn', nodeEnv: 'test' }, false);

    expect(logger.level).toBe('warn');
  });

  it('writes plain JSON in development without a terminal (containers have no pino-pretty)', () => {
    const logger = createLogger({ logLevel: 'info', nodeEnv: 'development' }, false);

    expect(streamOf(logger)?.constructor.name).not.toBe('ThreadStream');
  });
});

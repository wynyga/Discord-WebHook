import { pino, type Logger, type LoggerOptions } from 'pino';
import type { Config } from '../config/env.js';

export type { Logger };

/** Fields that may carry secrets; pino replaces them with `[Redacted]`. */
const REDACT_PATHS = [
  'req.headers.authorization',
  'webhookUrl',
  '*.webhookUrl',
  'password',
  '*.password',
];

/**
 * JSON logs everywhere except a developer's terminal. Containers have no TTY, so they never load
 * pino-pretty, which is a dev dependency and absent from the production image.
 */
export function createLogger(
  config: Pick<Config, 'logLevel' | 'nodeEnv'>,
  isTerminal: boolean = Boolean(process.stdout.isTTY),
): Logger {
  const options: LoggerOptions = {
    level: config.logLevel,
    redact: { paths: REDACT_PATHS },
  };
  if (config.nodeEnv === 'development' && isTerminal) {
    options.transport = { target: 'pino-pretty', options: { translateTime: 'SYS:standard' } };
  }
  return pino(options);
}

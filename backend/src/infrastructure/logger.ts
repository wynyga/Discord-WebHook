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

export function createLogger(config: Pick<Config, 'logLevel' | 'nodeEnv'>): Logger {
  const options: LoggerOptions = {
    level: config.logLevel,
    redact: { paths: REDACT_PATHS },
  };
  if (config.nodeEnv === 'development') {
    options.transport = { target: 'pino-pretty', options: { translateTime: 'SYS:standard' } };
  }
  return pino(options);
}

import { pino } from 'pino';
import type { Logger } from '../../src/infrastructure/logger.js';

export function silentLogger(): Logger {
  return pino({ level: 'silent' });
}

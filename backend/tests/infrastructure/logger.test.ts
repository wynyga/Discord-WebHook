import { describe, expect, it } from 'vitest';
import { createLogger } from '../../src/infrastructure/logger.js';

describe('createLogger', () => {
  it('uses the configured level', () => {
    const logger = createLogger({ logLevel: 'warn', nodeEnv: 'test' });

    expect(logger.level).toBe('warn');
  });
});

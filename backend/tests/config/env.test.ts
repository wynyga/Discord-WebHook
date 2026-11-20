import { describe, expect, it } from 'vitest';
import { ConfigError, DEV_ADMIN_PASSWORD, DEV_JWT_SECRET, loadConfig } from '../../src/config/env.js';

const validEnv = {
  DATABASE_URL: 'postgres://postgres:postgres@localhost:5432/scheduler',
  REDIS_URL: 'redis://localhost:6379',
  JWT_SECRET: 'a-very-long-secret-used-only-in-unit-tests',
  ADMIN_USERNAME: 'admin',
  ADMIN_PASSWORD: 'secret',
};

describe('loadConfig', () => {
  it('parses a valid environment and applies defaults', () => {
    const config = loadConfig(validEnv);

    expect(config).toMatchObject({
      nodeEnv: 'development',
      port: 3000,
      logLevel: 'info',
      jwt: { secret: validEnv.JWT_SECRET, expiresIn: '1h' },
      admin: { username: 'admin', password: 'secret' },
      corsOrigin: ['http://localhost:5173'],
      workerConcurrency: 5,
      discordTimeoutMs: 10_000,
    });
  });

  it('coerces PORT and splits CORS_ORIGIN', () => {
    const config = loadConfig({
      ...validEnv,
      PORT: '8080',
      CORS_ORIGIN: 'http://a.test, http://b.test',
    });

    expect(config.port).toBe(8080);
    expect(config.corsOrigin).toEqual(['http://a.test', 'http://b.test']);
  });

  it('lists every missing variable', () => {
    expect(() => loadConfig({})).toThrow(ConfigError);
    try {
      loadConfig({});
    } catch (err) {
      const message = (err as Error).message;
      for (const key of ['DATABASE_URL', 'REDIS_URL', 'JWT_SECRET', 'ADMIN_USERNAME', 'ADMIN_PASSWORD']) {
        expect(message).toContain(key);
      }
    }
  });

  it.each([
    ['DATABASE_URL', 'mysql://localhost/db'],
    ['REDIS_URL', 'http://localhost:6379'],
    ['JWT_SECRET', 'too-short'],
    ['JWT_EXPIRES_IN', 'one hour'],
    ['PORT', '70000'],
    ['WORKER_CONCURRENCY', '0'],
    ['DISCORD_TIMEOUT_MS', '100'],
  ])('rejects invalid %s', (key, value) => {
    expect(() => loadConfig({ ...validEnv, [key]: value })).toThrow(key);
  });

  it('accepts dev defaults outside production', () => {
    const config = loadConfig({ ...validEnv, JWT_SECRET: DEV_JWT_SECRET, ADMIN_PASSWORD: DEV_ADMIN_PASSWORD });

    expect(config.jwt.secret).toBe(DEV_JWT_SECRET);
  });

  it('refuses dev defaults in production', () => {
    const env = {
      ...validEnv,
      NODE_ENV: 'production',
      JWT_SECRET: DEV_JWT_SECRET,
      ADMIN_PASSWORD: DEV_ADMIN_PASSWORD,
    };

    expect(() => loadConfig(env)).toThrow(/JWT_SECRET[\s\S]*ADMIN_PASSWORD|ADMIN_PASSWORD[\s\S]*JWT_SECRET/);
  });
});

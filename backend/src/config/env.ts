import { z } from 'zod';

/** Local defaults shipped in `.env.example` and docker-compose; never valid in production. */
export const DEV_JWT_SECRET = 'dev-only-change-me-at-least-32-chars';
export const DEV_ADMIN_PASSWORD = 'admin';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    REDIS_URL: z.url({ protocol: /^rediss?$/ }),
    JWT_SECRET: z.string().min(32, 'must be at least 32 characters'),
    JWT_EXPIRES_IN: z
      .string()
      .regex(/^\d+[smhd]$/, 'must look like 15m, 1h or 7d')
      .default('1h'),
    ADMIN_USERNAME: z.string().min(1),
    ADMIN_PASSWORD: z.string().min(1),
    CORS_ORIGIN: z.string().min(1).default('http://localhost:5173'),
    WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(50).default(5),
    DISCORD_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60_000).default(10_000),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;
    if (env.JWT_SECRET === DEV_JWT_SECRET) {
      ctx.addIssue({ code: 'custom', path: ['JWT_SECRET'], message: 'dev default in production' });
    }
    if (env.ADMIN_PASSWORD === DEV_ADMIN_PASSWORD) {
      ctx.addIssue({ code: 'custom', path: ['ADMIN_PASSWORD'], message: 'dev default in production' });
    }
  })
  .transform((env) => ({
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    logLevel: env.LOG_LEVEL,
    databaseUrl: env.DATABASE_URL,
    redisUrl: env.REDIS_URL,
    jwt: { secret: env.JWT_SECRET, expiresIn: env.JWT_EXPIRES_IN },
    admin: { username: env.ADMIN_USERNAME, password: env.ADMIN_PASSWORD },
    corsOrigin: env.CORS_ORIGIN.split(',').map((origin) => origin.trim()),
    workerConcurrency: env.WORKER_CONCURRENCY,
    discordTimeoutMs: env.DISCORD_TIMEOUT_MS,
  }));

export type Config = z.infer<typeof envSchema>;

export class ConfigError extends Error {
  override readonly name = 'ConfigError';
}

/** Parses the environment once at boot; throws `ConfigError` listing every invalid variable. */
export function loadConfig(source: NodeJS.ProcessEnv = process.env): Config {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new ConfigError(`Invalid environment:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

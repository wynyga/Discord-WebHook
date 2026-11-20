import { Router } from 'express';

/** A named dependency probe; it rejects when the dependency is unreachable. */
export type HealthCheck = () => Promise<void>;

/** A probe that hangs (e.g. Redis reconnecting) counts as down instead of blocking the response. */
export const HEALTH_CHECK_TIMEOUT_MS = 2000;

export function createHealthRouter(checks: Record<string, HealthCheck>, timeoutMs = HEALTH_CHECK_TIMEOUT_MS): Router {
  const router = Router();

  router.get('/health', async (_req, res) => {
    const entries = await Promise.all(
      Object.entries(checks).map(async ([name, check]) => {
        try {
          await withTimeout(check(), timeoutMs);
          return [name, 'up'] as const;
        } catch {
          return [name, 'down'] as const;
        }
      }),
    );
    const healthy = entries.every(([, state]) => state === 'up');
    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'ok' : 'degraded',
      checks: Object.fromEntries(entries),
    });
  });

  return router;
}

async function withTimeout(probe: Promise<void>, ms: number): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out after ${ms} ms`)), ms);
  });
  try {
    await Promise.race([probe, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

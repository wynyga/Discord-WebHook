import { Router } from 'express';

/** A named dependency probe; it rejects when the dependency is unreachable. */
export type HealthCheck = () => Promise<void>;

export function createHealthRouter(checks: Record<string, HealthCheck>): Router {
  const router = Router();

  router.get('/health', async (_req, res) => {
    const entries = await Promise.all(
      Object.entries(checks).map(async ([name, check]) => {
        try {
          await check();
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

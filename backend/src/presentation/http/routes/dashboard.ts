import { Router } from 'express';
import type { GetDashboardSummary } from '../../../application/dashboard/get-dashboard-summary.js';

export function createDashboardRouter(getSummary: GetDashboardSummary): Router {
  const router = Router();

  router.get('/dashboard/summary', async (_req, res) => {
    res.json({ data: await getSummary.execute() });
  });

  return router;
}

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { SyncStatus } from '../../models/SyncStatus';

export function createHealthRouter(pool: Pool) {
  const router = Router();

  router.get('/', async (req: Request, res: Response) => {
    try {
      await pool.query('SELECT 1');

      const lastSync = await SyncStatus.getLastSuccessful();

      res.json({
        status: 'healthy',
        database: 'connected',
        lastSync: lastSync ? {
          type: lastSync.sync_type,
          completedAt: lastSync.completed_at,
          totalBooks: lastSync.total_books,
        } : null,
      });
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        database: 'disconnected',
        error: (error as Error).message,
      });
    }
  });

  return router;
}

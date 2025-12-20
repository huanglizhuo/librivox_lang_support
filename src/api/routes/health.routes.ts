import { Router, Request, Response } from 'express';
import { pool } from '../../config/database';
import { SyncStatus } from '../../models/SyncStatus';

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

export default router;

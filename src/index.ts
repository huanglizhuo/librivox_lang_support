import dotenv from 'dotenv';
dotenv.config();

import { createServer } from './server';
import { SyncScheduler } from './jobs/scheduler';
import logger from './utils/logger';
import { pool } from './config/database';

const PORT = process.env.PORT || 3000;

async function main() {
  try {
    await pool.query('SELECT 1');
    logger.info('Database connected');

    const app = createServer();
    app.listen(PORT, () => {
      logger.info(`API server listening on port ${PORT}`);
    });

    const scheduler = new SyncScheduler();
    scheduler.start();

    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully');
      scheduler.stop();
      await pool.end();
      process.exit(0);
    });

  } catch (error) {
    logger.error('Failed to start application', { error });
    process.exit(1);
  }
}

main();

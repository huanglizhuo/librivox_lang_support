import dotenv from 'dotenv';
dotenv.config();

import { createServer } from './server';
import { SyncScheduler } from './jobs/scheduler';
import { config } from './config';
import logger from './utils/logger';
import { pool } from './config/database';

async function main() {
  try {
    await pool.query('SELECT 1');
    logger.info('Database connected');

    const app = createServer(pool);
    app.listen(config.api.port, () => {
      logger.info(`API server listening on port ${config.api.port}`);
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

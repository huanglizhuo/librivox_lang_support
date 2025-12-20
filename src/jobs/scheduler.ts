import cron from 'node-cron';
import { IncrementalSyncJob } from './incrementalSync';
import { FullSyncJob } from './fullSync';
import logger from '../utils/logger';

export class SyncScheduler {
  private incrementalSyncJob: IncrementalSyncJob;
  private isRunning = false;

  constructor() {
    this.incrementalSyncJob = new IncrementalSyncJob();
  }

  start(): void {
    const cronEnabled = process.env.ENABLE_SYNC_CRON === 'true';

    if (!cronEnabled) {
      logger.info('Cron scheduler disabled');
      return;
    }

    cron.schedule('0 2 * * *', async () => {
      if (this.isRunning) {
        logger.warn('Sync already running, skipping');
        return;
      }

      this.isRunning = true;

      try {
        logger.info('Cron triggered full sync');
        // Daily full sync to ensure data consistency
        const fullSyncJob = new FullSyncJob();
        await fullSyncJob.run();
      } catch (error) {
        logger.error('Cron sync failed', { error });
      } finally {
        this.isRunning = false;
      }
    });

    logger.info('Cron scheduler started (daily full sync at 2 AM UTC)');
  }

  stop(): void {
    cron.getTasks().forEach(task => task.stop());
    logger.info('Cron scheduler stopped');
  }
}

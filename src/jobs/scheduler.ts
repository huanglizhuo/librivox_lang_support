import cron from 'node-cron';
import { FullSyncJob } from './fullSync';
import { config } from '../config';
import logger from '../utils/logger';

export class SyncScheduler {
  private isRunning = false;

  start(): void {
    if (!config.sync.cronEnabled) {
      logger.info('Cron scheduler disabled');
      return;
    }

    cron.schedule(config.sync.cronSchedule, async () => {
      if (this.isRunning) {
        logger.warn('Sync already running, skipping');
        return;
      }

      this.isRunning = true;

      try {
        logger.info('Cron triggered full sync');
        await new FullSyncJob().run();
      } catch (error) {
        logger.error('Cron sync failed', { error });
      } finally {
        this.isRunning = false;
      }
    });

    logger.info(`Cron scheduler started (schedule: ${config.sync.cronSchedule})`);
  }

  stop(): void {
    cron.getTasks().forEach(task => task.stop());
    logger.info('Cron scheduler stopped');
  }
}

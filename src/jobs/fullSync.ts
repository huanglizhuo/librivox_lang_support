import { SyncService } from '../services/sync.service';
import { LibriVoxService } from '../services/librivox.service';
import { SyncStatus } from '../models/SyncStatus';
import { withRetry } from '../utils/retry';
import { SyncError } from '../utils/errors';
import { config } from '../config';
import logger from '../utils/logger';

export class FullSyncJob {
  private syncService = new SyncService();
  private librivoxService = new LibriVoxService();

  async run(resumeFromOffset?: number): Promise<void> {
    logger.info('Starting full sync job', { resumeFromOffset });

    const syncId = await SyncStatus.create('full', { resumedFrom: resumeFromOffset });

    let offset = resumeFromOffset ?? 0;
    let totalSynced = 0;

    try {
      while (true) {
        logger.info('Fetching batch', { offset, batchSize: config.sync.batchSize });

        const response = await this.librivoxService.fetchBooks({
          offset,
          limit: config.sync.batchSize,
        });

        if (!response.books || response.books.length === 0) {
          logger.info('No more books to sync');
          break;
        }

        await withRetry(() => this.syncService.syncBatch(response.books));

        totalSynced += response.books.length;
        offset += config.sync.batchSize;

        await SyncStatus.updateProgress(syncId, totalSynced, offset);
        logger.info('Batch synced', { batchSize: response.books.length, totalSynced, nextOffset: offset });

        if (offset > config.sync.safetyOffsetLimit) {
          logger.warn('Safety limit reached, stopping sync');
          break;
        }
      }

      await SyncStatus.complete(syncId, totalSynced);
      logger.info('Full sync completed', { totalSynced });

    } catch (error) {
      const message = (error as Error).message;
      await SyncStatus.fail(syncId, message);
      logger.error('Full sync failed', { error, offset, totalSynced });
      throw new SyncError(`Full sync failed at offset ${offset}: ${message}`, error);
    }
  }
}

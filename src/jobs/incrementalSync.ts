import { SyncService } from '../services/sync.service';
import { LibriVoxService } from '../services/librivox.service';
import { SyncStatus } from '../models/SyncStatus';
import { SyncError } from '../utils/errors';
import { config } from '../config';
import logger from '../utils/logger';

export class IncrementalSyncJob {
  private syncService = new SyncService();
  private librivoxService = new LibriVoxService();

  async run(): Promise<void> {
    logger.info('Starting incremental sync job');

    const lastSync = await SyncStatus.getLastSuccessful();

    if (!lastSync) {
      throw new SyncError('No previous sync found, run full sync first');
    }

    const sinceTimestamp = Math.floor(new Date(lastSync.completed_at).getTime() / 1000);

    logger.info('Syncing changes since', { sinceDate: lastSync.completed_at, sinceTimestamp });

    const syncId = await SyncStatus.create('incremental', {
      since: sinceTimestamp,
      sinceDate: lastSync.completed_at,
    });

    let offset = 0;
    let totalSynced = 0;

    try {
      while (true) {
        const response = await this.librivoxService.fetchBooks({
          offset,
          limit: config.sync.batchSize,
          since: sinceTimestamp,
        });

        if (!response.books || response.books.length === 0) break;

        await this.syncService.syncBatch(response.books);
        totalSynced += response.books.length;
        offset += config.sync.batchSize;

        logger.info('Incremental batch synced', { batchSize: response.books.length, totalSynced });
      }

      await SyncStatus.complete(syncId, totalSynced);
      logger.info('Incremental sync completed', { totalSynced });

    } catch (error) {
      const message = (error as Error).message;
      await SyncStatus.fail(syncId, message);
      logger.error('Incremental sync failed', { error });
      throw new SyncError(`Incremental sync failed: ${message}`, error);
    }
  }
}

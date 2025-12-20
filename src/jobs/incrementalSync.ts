import { SyncService } from '../services/sync.service';
import { LibriVoxService } from '../services/librivox.service';
import { SyncStatus } from '../models/SyncStatus';
import logger from '../utils/logger';

export class IncrementalSyncJob {
  private syncService: SyncService;
  private librivoxService: LibriVoxService;
  private readonly batchSize = 100;

  constructor() {
    this.syncService = new SyncService();
    this.librivoxService = new LibriVoxService();
  }

  async run(): Promise<void> {
    logger.info('Starting incremental sync job');

    const lastSync = await SyncStatus.getLastSuccessful();

    if (!lastSync) {
      logger.warn('No previous sync found, run full sync first');
      throw new Error('Run full sync before incremental sync');
    }

    const sinceTimestamp = Math.floor(
      new Date(lastSync.completed_at).getTime() / 1000
    );

    logger.info('Syncing changes since', {
      sinceDate: lastSync.completed_at,
      sinceTimestamp
    });

    const syncId = await SyncStatus.create('incremental', {
      since: sinceTimestamp,
      sinceDate: lastSync.completed_at
    });

    let offset = 0;
    let totalSynced = 0;
    let hasMore = true;

    try {
      while (hasMore) {
        const response = await this.librivoxService.fetchBooks({
          offset,
          limit: this.batchSize,
          since: sinceTimestamp,
        });

        if (!response.books || response.books.length === 0) {
          hasMore = false;
          break;
        }

        await this.syncService.syncBatch(response.books);

        totalSynced += response.books.length;
        offset += this.batchSize;

        logger.info('Incremental batch synced', {
          batchSize: response.books.length,
          totalSynced
        });
      }

      await SyncStatus.complete(syncId, totalSynced);
      logger.info('Incremental sync completed', { totalSynced });

    } catch (error) {
      await SyncStatus.fail(syncId, (error as Error).message);
      logger.error('Incremental sync failed', { error });
      throw error;
    }
  }
}

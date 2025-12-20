import { SyncService } from '../services/sync.service';
import { LibriVoxService } from '../services/librivox.service';
import { SyncStatus } from '../models/SyncStatus';
import { sleep } from '../utils/retry';
import logger from '../utils/logger';

export class FullSyncJob {
  private syncService: SyncService;
  private librivoxService: LibriVoxService;
  private readonly batchSize = 100;

  constructor() {
    this.syncService = new SyncService();
    this.librivoxService = new LibriVoxService();
  }

  async run(resumeFromOffset?: number): Promise<void> {
    logger.info('Starting full sync job', { resumeFromOffset });

    const syncId = await SyncStatus.create('full', {
      resumedFrom: resumeFromOffset
    });

    let offset = resumeFromOffset || 0;
    let totalSynced = 0;
    let hasMore = true;

    try {
      while (hasMore) {
        logger.info('Fetching batch', { offset, batchSize: this.batchSize });

        const response = await this.librivoxService.fetchBooks({
          offset,
          limit: this.batchSize,
        });

        if (!response.books || response.books.length === 0) {
          logger.info('No more books to sync');
          hasMore = false;
          break;
        }

        try {
          await this.syncService.syncBatch(response.books);
          // todo remove below beak for debug
          // if (totalSynced >= 100) {
          //   break;
          // }
          totalSynced += response.books.length;
          offset += this.batchSize;

          await SyncStatus.updateProgress(syncId, totalSynced, offset);

          logger.info('Batch synced successfully', {
            batchSize: response.books.length,
            totalSynced,
            nextOffset: offset
          });

        } catch (batchError) {
          logger.error('Batch sync failed, will retry', {
            offset,
            error: batchError
          });

          let retries = 0;
          while (retries < 3) {
            try {
              await sleep(5000 * (retries + 1));
              await this.syncService.syncBatch(response.books);
              logger.info('Batch retry succeeded', { offset, retries });
              totalSynced += response.books.length;
              offset += this.batchSize;
              break;
            } catch (retryError) {
              retries++;
              if (retries === 3) {
                throw new Error(`Batch failed after 3 retries: ${(retryError as Error).message}`);
              }
            }
          }
        }

        if (offset > 100000) {
          logger.warn('Safety limit reached, stopping sync');
          break;
        }
      }

      await SyncStatus.complete(syncId, totalSynced);
      logger.info('Full sync completed successfully', { totalSynced });

    } catch (error) {
      await SyncStatus.fail(syncId, (error as Error).message);
      logger.error('Full sync failed', { error, offset, totalSynced });
      throw error;
    }
  }
}

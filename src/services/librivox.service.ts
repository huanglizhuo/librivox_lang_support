import { LibriVoxApiResponse } from '../types/librivox.types';
import { fetchWithRetry, sleep } from '../utils/retry';
import logger from '../utils/logger';

export class LibriVoxService {
  private readonly baseUrl = 'https://librivox.org/api/feed/audiobooks/';
  private readonly batchSize: number;
  private readonly rateLimitMs: number;

  constructor() {
    this.batchSize = parseInt(process.env.SYNC_BATCH_SIZE || '100');
    this.rateLimitMs = parseInt(process.env.SYNC_RATE_LIMIT_MS || '1000');
  }

  async fetchBooks(params: {
    offset: number;
    limit?: number;
    since?: number;
  }): Promise<LibriVoxApiResponse> {
    const limit = params.limit || this.batchSize;
    const queryParams = new URLSearchParams({
      format: 'json',
      extended: '1',
      limit: limit.toString(),
      offset: params.offset.toString(),
    });

    if (params.since) {
      queryParams.append('since', params.since.toString());
    }

    const url = `${this.baseUrl}?${queryParams.toString()}`;

    logger.info('Fetching from LibriVox API', { url, offset: params.offset });

    const data = await fetchWithRetry<LibriVoxApiResponse>(url);

    // Rate limiting: wait before next request
    await sleep(this.rateLimitMs);

    return data;
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.fetchBooks({ offset: 0, limit: 1 });
      return !!response.books;
    } catch (error) {
      logger.error('LibriVox API connection test failed', error);
      return false;
    }
  }
}

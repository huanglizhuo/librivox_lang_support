import { LibriVoxApiResponse } from '../types/librivox.types';
import { fetchWithRetry, sleep } from '../utils/retry';
import { LibriVoxApiError } from '../utils/errors';
import { config } from '../config';
import logger from '../utils/logger';

export class LibriVoxService {
  private readonly baseUrl = 'https://librivox.org/api/feed/audiobooks/';

  async fetchBooks(params: {
    offset: number;
    limit?: number;
    since?: number;
  }): Promise<LibriVoxApiResponse> {
    const limit = params.limit ?? config.sync.batchSize;
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

    try {
      const data = await fetchWithRetry<LibriVoxApiResponse>(url);
      await sleep(config.sync.rateLimitMs);
      return data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.info('Reached end of available books (404)', { offset: params.offset });
        return { books: [] };
      }
      throw new LibriVoxApiError(
        `LibriVox API request failed: ${(error as Error).message}`,
        error.response?.status,
      );
    }
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

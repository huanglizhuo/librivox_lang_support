import axios, { AxiosError } from 'axios';
import logger from './logger';

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function fetchWithRetry<T>(
  url: string,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    timeout?: number;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 5000,
    maxDelay = 30000,
    timeout = 30000
  } = options;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await axios.get(url, {
        timeout,
        headers: {
          'User-Agent': 'LibriVoxSync/1.0 (educational project)',
        },
      });
      return response.data;
    } catch (error) {
      const isLastAttempt = attempt === maxRetries - 1;

      if (isLastAttempt) {
        throw error;
      }

      // Determine if error is retryable
      const axiosError = error as AxiosError;
      const isRetryable =
        axiosError.code === 'ECONNRESET' ||
        axiosError.code === 'ETIMEDOUT' ||
        axiosError.code === 'ENOTFOUND' ||
        (axiosError.response && axiosError.response.status >= 500);

      if (!isRetryable) {
        throw error;
      }

      // Exponential backoff with max delay cap
      const delay = Math.min(initialDelay * Math.pow(2, attempt), maxDelay);
      logger.warn(`Request failed, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`, {
        url,
        error: axiosError.message
      });

      await sleep(delay);
    }
  }

  throw new Error('fetchWithRetry: Unexpected end of retry loop');
}

import axios, { AxiosError } from 'axios';
import { config } from '../config';
import logger from './logger';

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
  } = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? config.sync.maxRetries;
  const baseDelayMs = options.baseDelayMs ?? config.sync.retryBaseDelayMs;
  const maxDelayMs = options.maxDelayMs ?? config.sync.retryMaxDelayMs;

  let lastError: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries - 1) {
        const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
        logger.warn(`Attempt ${attempt + 1}/${maxRetries} failed, retrying in ${delay}ms`);
        await sleep(delay);
      }
    }
  }
  throw lastError;
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
    maxRetries = config.sync.maxRetries,
    initialDelay = config.sync.retryBaseDelayMs,
    maxDelay = config.sync.retryMaxDelayMs,
    timeout = 30000,
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

      const axiosError = error as AxiosError;
      const isRetryable =
        axiosError.code === 'ECONNRESET' ||
        axiosError.code === 'ETIMEDOUT' ||
        axiosError.code === 'ENOTFOUND' ||
        (axiosError.response && axiosError.response.status >= 500);

      if (!isRetryable) {
        throw error;
      }

      const delay = Math.min(initialDelay * Math.pow(2, attempt), maxDelay);
      logger.warn(`Request failed, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`, {
        url,
        error: axiosError.message,
      });

      await sleep(delay);
    }
  }

  throw new Error('fetchWithRetry: Unexpected end of retry loop');
}

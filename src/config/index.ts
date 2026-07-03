export const config = {
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    name: process.env.DB_NAME || 'librivox',
    user: process.env.DB_USER || 'librivox_user',
    password: process.env.DB_PASSWORD || '',
    ssl: process.env.DB_SSL === 'true',
    maxConnections: 20,
    idleTimeoutMs: 30_000,
    connectionTimeoutMs: 2_000,
  },
  sync: {
    batchSize: parseInt(process.env.SYNC_BATCH_SIZE || '100'),
    rateLimitMs: parseInt(process.env.SYNC_RATE_LIMIT_MS || '1000'),
    maxRetries: 3,
    retryBaseDelayMs: 5_000,
    retryMaxDelayMs: 30_000,
    safetyOffsetLimit: 100_000,
    cronEnabled: process.env.ENABLE_SYNC_CRON === 'true',
    cronSchedule: process.env.SYNC_CRON_SCHEDULE || '0 2 * * *',
  },
  api: {
    port: parseInt(process.env.PORT || '3000'),
    maxPageSize: 100,
  },
  log: {
    level: process.env.LOG_LEVEL || 'info',
    env: process.env.NODE_ENV || 'development',
  },
};

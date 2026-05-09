import express from 'express';
import { Pool } from 'pg';
import createAudiobooksRouter from './api/routes/audiobooks.routes';
import { createHealthRouter } from './api/routes/health.routes';
import { errorHandler } from './api/middlewares/errorHandler';
import logger from './utils/logger';

export function createServer(pool: Pool) {
  const app = express();

  app.use(express.json());

  app.use((req, res, next) => {
    logger.info('API request', {
      method: req.method,
      path: req.path,
      query: req.query,
    });
    next();
  });

  app.use('/audiobooks', createAudiobooksRouter(pool));
  app.use('/health', createHealthRouter(pool));

  app.use(errorHandler);

  return app;
}

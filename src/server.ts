import express from 'express';
import audiobooksRoutes from './api/routes/audiobooks.routes';
import healthRoutes from './api/routes/health.routes';
import { errorHandler } from './api/middlewares/errorHandler';
import logger from './utils/logger';

export function createServer() {
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

  app.use('/audiobooks', audiobooksRoutes);
  app.use('/health', healthRoutes);

  app.use(errorHandler);

  return app;
}

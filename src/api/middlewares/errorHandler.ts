import { Request, Response, NextFunction } from 'express';
import { LibriVoxApiError } from '../../utils/errors';
import { config } from '../../config';
import logger from '../../utils/logger';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  logger.error('API error', {
    name: err.name,
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  if (err instanceof LibriVoxApiError) {
    res.status(502).json({
      error: 'Upstream API error',
      message: config.log.env === 'development' ? err.message : undefined,
    });
    return;
  }

  res.status(500).json({
    error: 'Internal server error',
    message: config.log.env === 'development' ? err.message : undefined,
  });
}

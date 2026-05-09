import { Router } from 'express';
import { Pool } from 'pg';
import { AudiobooksController } from '../controllers/audiobooks.controller';

export default function createAudiobooksRouter(pool: Pool) {
  const router = Router();
  const controller = new AudiobooksController(pool);

  router.get('/', controller.list);
  router.get('/stats/languages', controller.getLanguageStats);
  router.get('/:id', controller.getById);

  return router;
}

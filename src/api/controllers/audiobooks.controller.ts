import { Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { AudiobookService } from '../../services/audiobook.service';
import Joi from 'joi';

const listSchema = Joi.object({
  language: Joi.string().required(),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  sort: Joi.string().valid('title', 'updated_at').optional(),
  order: Joi.string().valid('asc', 'desc').optional(),
});

export class AudiobooksController {
  private audiobookService: AudiobookService;

  constructor(pool: Pool) {
    this.audiobookService = new AudiobookService(pool);
  }

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { error, value } = listSchema.validate(req.query);

      if (error) {
        return res.status(400).json({ error: error.details[0].message });
      }

      const result = await this.audiobookService.list(value);
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid audiobook ID' });
      }

      const audiobook = await this.audiobookService.getById(id);

      if (!audiobook) {
        return res.status(404).json({ error: 'Audiobook not found' });
      }

      res.json(audiobook);
    } catch (err) {
      next(err);
    }
  };

  getLanguageStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const stats = await this.audiobookService.getLanguageStats();
      res.json(stats);
    } catch (err) {
      next(err);
    }
  };
}

import { Router } from 'express';
import { AudiobooksController } from '../controllers/audiobooks.controller';

const router = Router();
const controller = new AudiobooksController();

router.get('/', controller.list);
router.get('/:id', controller.getById);

export default router;

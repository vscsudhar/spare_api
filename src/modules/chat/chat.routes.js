import { Router } from 'express';
import chatController from './chat.controller.js';

const router = Router();

router.get('/', chatController.getAll);

export default router;

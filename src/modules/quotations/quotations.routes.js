import { Router } from 'express';
import quotationsController from './quotations.controller.js';

const router = Router();

router.get('/', quotationsController.getAll);

export default router;

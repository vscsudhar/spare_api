import { Router } from 'express';
import uploadsController from './uploads.controller.js';
import protect from '../../middlewares/auth.middleware.js';
import { upload } from '../../utils/storage.js';

const router = Router();

router.use(protect);

router.get('/', uploadsController.getAll);
router.post('/', upload.single('file'), uploadsController.uploadFile);

export default router;
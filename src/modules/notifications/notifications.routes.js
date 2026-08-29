import { Router } from 'express';
import notificationsController from './notifications.controller.js';
import validate from '../../middlewares/validate.js';
import protect from '../../middlewares/auth.middleware.js';
import { idParamSchema } from './notifications.validator.js';

const router = Router();
router.use(protect);

router.get('/', notificationsController.getAll);
router.get('/unread-count', notificationsController.getUnreadCount);
router.patch('/:id/read', validate(idParamSchema), notificationsController.markAsRead);
router.patch('/read-all', notificationsController.markAllAsRead);
router.delete('/:id', validate(idParamSchema), notificationsController.delete);

export default router;

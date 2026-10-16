import { Router } from 'express';
import notificationsController from './notifications.controller.js';
import validate from '../../middlewares/validate.js';
import protect from '../../middlewares/auth.middleware.js';
import {
  idParamSchema,
  registerDeviceTokenSchema,
  removeDeviceTokenSchema,
  sendSingleNotificationSchema,
  sendBulkNotificationSchema,
  adminHistoryQuerySchema,
  customersQuerySchema,
  batchIdsSchema,
} from './notifications.validator.js';

const router = Router();
router.use(protect);

// Customer & General Notification Endpoints
router.get('/', notificationsController.getAll);
router.get('/unread-count', notificationsController.getUnreadCount);
router.post('/device-token', validate(registerDeviceTokenSchema), notificationsController.registerDeviceToken);
router.delete('/device-token', validate(removeDeviceTokenSchema), notificationsController.removeDeviceToken);
router.post('/device-token/deactivate', validate(removeDeviceTokenSchema), notificationsController.removeDeviceToken);
router.patch('/:id/read', validate(idParamSchema), notificationsController.markAsRead);
router.patch('/:id/unread', validate(idParamSchema), notificationsController.markAsUnread);
router.post('/batch/read', validate(batchIdsSchema), notificationsController.batchMarkRead);
router.post('/batch/unread', validate(batchIdsSchema), notificationsController.batchMarkUnread);
router.post('/batch/delete', validate(batchIdsSchema), notificationsController.batchDelete);
router.patch('/read-all', notificationsController.markAllAsRead);

// Admin Notification Management Endpoints
router.post('/send-single', validate(sendSingleNotificationSchema), notificationsController.sendSingle);
router.post('/send-bulk', validate(sendBulkNotificationSchema), notificationsController.sendBulk);
router.get('/admin/history', validate(adminHistoryQuerySchema), notificationsController.getAdminHistory);
router.get('/customers-list', validate(customersQuerySchema), notificationsController.getCustomersList);

router.delete('/:id', validate(idParamSchema), notificationsController.delete);

export default router;

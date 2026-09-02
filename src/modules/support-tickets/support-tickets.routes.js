import { Router } from 'express';
import supportTicketsController from './support-tickets.controller.js';
import validate from '../../middlewares/validate.js';
import protect from '../../middlewares/auth.middleware.js';
import restrictTo from '../../middlewares/permission.middleware.js';
import { upload } from '../../utils/storage.js';
import {
  createTicketSchema,
  sendMessageSchema,
  updateStatusSchema,
  ticketIdParamSchema,
} from './support-tickets.validator.js';

const router = Router();
router.use(protect);

// Customer & General Routes
router.post(
  '/',
  upload.array('photos', 5),
  validate(createTicketSchema),
  supportTicketsController.createTicket
);

router.get('/my', supportTicketsController.getMyTickets);

router.get(
  '/:id',
  validate(ticketIdParamSchema),
  supportTicketsController.getTicketById
);

router.post(
  '/:id/messages',
  validate(ticketIdParamSchema),
  upload.array('photos', 5),
  validate(sendMessageSchema),
  supportTicketsController.sendMessage
);

router.patch(
  '/:id/status',
  validate(ticketIdParamSchema),
  validate(updateStatusSchema),
  supportTicketsController.updateStatus
);

// Admin Routes
router.get(
  '/admin/all',
  restrictTo('admin', 'staff', 'superadmin'),
  supportTicketsController.adminGetAll
);

export default router;

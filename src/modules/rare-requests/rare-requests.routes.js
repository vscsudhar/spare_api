import { Router } from 'express';
import rareRequestsController from './rare-requests.controller.js';
import validate from '../../middlewares/validate.js';
import protect from '../../middlewares/auth.middleware.js';
import restrictTo from '../../middlewares/permission.middleware.js';
import { upload } from '../../utils/storage.js';
import {
  idParamSchema,
  idAndQuotationIdParamSchema,
  createRequestSchema,
  updateRequestSchema,
  createMessageSchema,
  createQuotationSchema,
  updateQuotationSchema,
  updateStatusSchema,
} from './rare-requests.validator.js';

// 1. Customer Router
const rareRequestsRouter = Router();
rareRequestsRouter.use(protect);

rareRequestsRouter.post('/', validate(createRequestSchema), rareRequestsController.createRequest);
rareRequestsRouter.get('/my', rareRequestsController.getMyRequests);
rareRequestsRouter.get('/:id', validate(idParamSchema), rareRequestsController.getRequestById);
rareRequestsRouter.patch('/:id', validate(updateRequestSchema), rareRequestsController.updateRequest);
rareRequestsRouter.post('/:id/images', validate(idParamSchema), upload.array('images', 5), rareRequestsController.addRequestImages);
rareRequestsRouter.get('/:id/messages', validate(idParamSchema), rareRequestsController.getChatMessages);
rareRequestsRouter.post('/:id/messages', validate(createMessageSchema), rareRequestsController.sendChatMessage);
rareRequestsRouter.get('/:id/quotations', validate(idParamSchema), rareRequestsController.getQuotations);
rareRequestsRouter.patch('/:id/quotations/:quotationId/approve', validate(idAndQuotationIdParamSchema), rareRequestsController.approveQuotation);
rareRequestsRouter.patch('/:id/quotations/:quotationId/cancel', validate(idAndQuotationIdParamSchema), rareRequestsController.cancelQuotation);
rareRequestsRouter.post('/:id/reopen', validate(idParamSchema), rareRequestsController.reopenRequest);

// 2. Admin Router
const adminRareRequestsRouter = Router();
adminRareRequestsRouter.use(protect);

adminRareRequestsRouter.get('/', restrictTo('rare_requests.read'), rareRequestsController.adminGetAll);
adminRareRequestsRouter.get('/:id', restrictTo('rare_requests.read'), validate(idParamSchema), rareRequestsController.adminGetById);
adminRareRequestsRouter.patch('/:id/status', restrictTo('rare_requests.reply'), validate(updateStatusSchema), rareRequestsController.adminUpdateStatus);
adminRareRequestsRouter.post('/:id/messages', restrictTo('rare_requests.reply'), validate(createMessageSchema), rareRequestsController.adminSendChatMessage);
adminRareRequestsRouter.post('/:id/quotations', restrictTo('rare_requests.reply'), validate(createQuotationSchema), rareRequestsController.adminCreateQuotation);
adminRareRequestsRouter.patch('/:id/quotations/:quotationId', restrictTo('rare_requests.reply'), validate(updateQuotationSchema), rareRequestsController.adminUpdateQuotation);
adminRareRequestsRouter.post('/:id/quotations/:quotationId/send', restrictTo('rare_requests.reply'), validate(idAndQuotationIdParamSchema), rareRequestsController.adminSendQuotation);
adminRareRequestsRouter.post('/:id/convert-to-order', restrictTo('rare_requests.reply'), validate(idParamSchema), rareRequestsController.adminConvertToOrder);

export { rareRequestsRouter as default, adminRareRequestsRouter };

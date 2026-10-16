import { Router } from 'express';
import deliveryController from './delivery.controller.js';
import validate from '../../middlewares/validate.js';
import protect from '../../middlewares/auth.middleware.js';
import AppError from '../../errors/AppError.js';
import {
  deliveryStatusUpdateSchema,
  collectPaymentSchema,
  deliveryFilterSchema,
  deliveryIdParamSchema,
} from './delivery.validator.js';

const deliveryRouter = Router();

const restrictToDelivery = (req, res, next) => {
  if (req.user && req.user.role && req.user.role.name === 'customer') {
    return next(new AppError('Access denied: Delivery staff only.', 403));
  }
  next();
};

deliveryRouter.use(protect);
deliveryRouter.use(restrictToDelivery);

// 1. Dashboard summary
deliveryRouter.get('/dashboard', validate(deliveryFilterSchema), deliveryController.getDashboardSummary);

// 2. Assigned orders list
deliveryRouter.get('/orders', validate(deliveryFilterSchema), deliveryController.getAssignedOrders);

// 3. Single order details
deliveryRouter.get('/orders/:id', validate(deliveryIdParamSchema), deliveryController.getOrderById);

// 4. Update delivery status
deliveryRouter.patch(
  '/orders/:id/status',
  validate(deliveryStatusUpdateSchema),
  deliveryController.updateDeliveryStatus
);

// 5. Collect COD payment
deliveryRouter.post(
  '/orders/:id/collect-payment',
  validate(collectPaymentSchema),
  deliveryController.collectPayment
);

// 6. Collected amount history and breakdown
deliveryRouter.get('/collections', validate(deliveryFilterSchema), deliveryController.getCollections);

export default deliveryRouter;

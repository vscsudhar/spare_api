import { Router } from 'express';
import ordersController from './orders.controller.js';
import validate from '../../middlewares/validate.js';
import protect from '../../middlewares/auth.middleware.js';
import restrictTo from '../../middlewares/permission.middleware.js';
import {
  idParamSchema,
  createOrderSchema,
  adminUpdateStatusSchema,
  adminAssignDeliverySchema,
  adminAddNoteSchema,
} from './orders.validator.js';

// 1. Customer Orders Router
const ordersRouter = Router();
ordersRouter.use(protect);

ordersRouter.post('/', validate(createOrderSchema), ordersController.createOrder);
ordersRouter.get('/my', ordersController.getMyOrders);
ordersRouter.get('/my/:id', validate(idParamSchema), ordersController.getMyOrderById);
ordersRouter.post('/:id/cancel', validate(idParamSchema), ordersController.cancelMyOrder);

// 2. Customer Checkout Router
const checkoutRouter = Router();
checkoutRouter.use(protect);

checkoutRouter.post('/validate', validate(createOrderSchema), ordersController.validateCheckout);

// 3. Admin Orders Router
const adminOrdersRouter = Router();
adminOrdersRouter.use(protect);

adminOrdersRouter.get('/', restrictTo('orders.read'), ordersController.adminGetAll);
adminOrdersRouter.get('/:id', restrictTo('orders.read'), validate(idParamSchema), ordersController.adminGetById);
adminOrdersRouter.patch(
  '/:id/status',
  restrictTo('orders.update'),
  validate(adminUpdateStatusSchema),
  ordersController.adminUpdateStatus
);
adminOrdersRouter.post(
  '/:id/assign-delivery',
  restrictTo('orders.update'),
  validate(adminAssignDeliverySchema),
  ordersController.adminAssignDelivery
);
adminOrdersRouter.post(
  '/:id/notes',
  restrictTo('orders.update'),
  validate(adminAddNoteSchema),
  ordersController.adminAddNote
);

export { ordersRouter as default, checkoutRouter, adminOrdersRouter };

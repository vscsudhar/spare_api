import { Router } from 'express';
import cartController from './cart.controller.js';
import validate from '../../middlewares/validate.js';
import protect from '../../middlewares/auth.middleware.js';
import {
  itemIdParamSchema,
  addItemSchema,
  updateItemSchema,
  applyCouponSchema,
} from './cart.validator.js';

const router = Router();

// Protect all cart routes
router.use(protect);

router.get('/', cartController.getCart);
router.post('/items', validate(addItemSchema), cartController.addItem);
router.patch('/items/:itemId', validate(updateItemSchema), cartController.updateItem);
router.delete('/items/:itemId', validate(itemIdParamSchema), cartController.removeItem);
router.delete('/', cartController.clearCart);

router.post('/apply-coupon', validate(applyCouponSchema), cartController.applyCoupon);
router.delete('/coupon', cartController.removeCoupon);

export default router;

import { Router } from 'express';
import inventoryController from './inventory.controller.js';
import validate from '../../middlewares/validate.js';
import protect from '../../middlewares/auth.middleware.js';
import restrictTo from '../../middlewares/permission.middleware.js';
import {
  createAdjustmentSchema,
  productIdParamSchema,
} from './inventory.validator.js';

const router = Router();

// Secure all endpoints on inventory
router.use(protect);

router.get('/', restrictTo('inventory.read'), inventoryController.getAll);
router.get('/summary', restrictTo('inventory.read'), inventoryController.getSummary);
router.get('/low-stock', restrictTo('inventory.read'), inventoryController.getLowStock);
router.get('/out-of-stock', restrictTo('inventory.read'), inventoryController.getOutOfStock);
router.get(
  '/:productId/movements',
  restrictTo('inventory.read'),
  validate(productIdParamSchema),
  inventoryController.getMovements
);
router.post(
  '/adjustments',
  restrictTo('inventory.update'),
  validate(createAdjustmentSchema),
  inventoryController.createAdjustment
);

export default router;

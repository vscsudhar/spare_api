import { Router } from 'express';
import locationsController from './locations.controller.js';
import validate from '../../middlewares/validate.js';
import protect from '../../middlewares/auth.middleware.js';
import {
  idParamSchema,
  locationInventoryParamSchema,
  updateInventoryStockSchema,
  createLocationSchema,
  updateLocationSchema,
} from './locations.validator.js';

const router = Router();

// Secure all location management endpoints
router.use(protect);

// Location CRUD endpoints
router.get('/', locationsController.getAll);
router.post('/', validate(createLocationSchema), locationsController.create);
router.get('/:id', validate(idParamSchema), locationsController.getById);
router.put('/:id', validate(updateLocationSchema), locationsController.update);
router.patch('/:id', validate(updateLocationSchema), locationsController.update);
router.delete('/:id', validate(idParamSchema), locationsController.delete);

// Location-wise Inventory endpoints
router.get('/:locationId/inventory', validate(locationInventoryParamSchema), locationsController.getInventory);
router.put(
  '/:locationId/inventory/:productId',
  validate(updateInventoryStockSchema),
  locationsController.updateInventory
);
router.delete(
  '/:locationId/inventory/:productId',
  validate(locationInventoryParamSchema),
  locationsController.deleteInventory
);

export default router;

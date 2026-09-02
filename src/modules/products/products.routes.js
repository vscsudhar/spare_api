import { Router } from 'express';
import productsController from './products.controller.js';
import validate from '../../middlewares/validate.js';
import protect, { optionalProtect } from '../../middlewares/auth.middleware.js';
import restrictTo from '../../middlewares/permission.middleware.js';
import {
  idParamSchema,
  imageIdParamSchema,
  createProductSchema,
  updateProductSchema,
  updateProductStatusSchema,
} from './products.validator.js';

const router = Router();

// Public Catalog endpoints
router.get('/', optionalProtect, productsController.getAll);
router.get('/search', optionalProtect, productsController.getSearch);
router.get('/featured', optionalProtect, productsController.getFeatured);
router.get('/:id', optionalProtect, validate(idParamSchema), productsController.getById);

// Protected administrative catalog endpoints
router.post('/', protect, restrictTo('products.create'), validate(createProductSchema), productsController.create);
router.patch('/:id', protect, restrictTo('products.update'), validate(updateProductSchema), productsController.update);
router.delete('/:id', protect, restrictTo('products.delete'), validate(idParamSchema), productsController.delete);
router.patch(
  '/:id/status',
  protect,
  restrictTo('products.update'),
  validate(updateProductStatusSchema),
  productsController.updateStatus
);
router.post('/:id/images', protect, restrictTo('products.update'), validate(idParamSchema), productsController.addImage);
router.delete(
  '/:id/images/:imageId',
  protect,
  restrictTo('products.update'),
  validate(imageIdParamSchema),
  productsController.deleteImage
);

export default router;

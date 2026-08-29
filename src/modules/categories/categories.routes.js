import { Router } from 'express';
import categoriesController from './categories.controller.js';
import validate from '../../middlewares/validate.js';
import protect from '../../middlewares/auth.middleware.js';
import restrictTo from '../../middlewares/permission.middleware.js';
import {
  createCategorySchema,
  updateCategorySchema,
} from './categories.validator.js';

const router = Router();

// Public / Guest endpoints
router.get('/', categoriesController.getAll);

// Protected endpoints
router.post('/', protect, restrictTo('products.create'), validate(createCategorySchema), categoriesController.create);
router.patch('/:id', protect, restrictTo('products.update'), validate(updateCategorySchema), categoriesController.update);

export default router;

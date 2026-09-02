import { Router } from 'express';
import { returnsController } from './returns.controller.js';
import validate from '../../middlewares/validate.js';
import protect from '../../middlewares/auth.middleware.js';
import restrictTo from '../../middlewares/permission.middleware.js';
import { createCaseSchema, updateCaseStatusSchema } from './returns.validator.js';

const router = Router();
router.use(protect);

// Search bill/order for return eligibility
router.get('/search-bill', restrictTo('orders.read'), returnsController.searchBill);

// Case management
router.post('/', restrictTo('orders.update'), validate(createCaseSchema), returnsController.createCase);
router.get('/', restrictTo('orders.read'), returnsController.getAll);
router.get('/damaged-items', restrictTo('orders.read'), returnsController.getDamagedItems);

router.get('/:id', restrictTo('orders.read'), returnsController.getById);
router.patch('/:id/status', restrictTo('orders.update'), validate(updateCaseStatusSchema), returnsController.updateStatus);

export default router;

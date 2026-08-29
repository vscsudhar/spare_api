import { Router } from 'express';
import billingController from './billing.controller.js';
import validate from '../../middlewares/validate.js';
import protect from '../../middlewares/auth.middleware.js';
import restrictTo from '../../middlewares/permission.middleware.js';
import { posPreviewSchema, posCheckoutSchema } from './billing.validator.js';

const router = Router();
router.use(protect);

// Get past invoices (restricted to billing.create/view permission, or billing.create)
router.get('/', restrictTo('billing.create'), billingController.getAll);

// POS Operations
router.post('/preview', restrictTo('billing.create'), validate(posPreviewSchema), billingController.preview);
router.post('/checkout', restrictTo('billing.create'), validate(posCheckoutSchema), billingController.checkout);

export default router;

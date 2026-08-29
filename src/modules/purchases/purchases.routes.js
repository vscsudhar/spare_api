import { Router } from 'express';
import purchasesController from './purchases.controller.js';
import validate from '../../middlewares/validate.js';
import protect from '../../middlewares/auth.middleware.js';
import restrictTo from '../../middlewares/permission.middleware.js';
import {
  idParamSchema,
  createPurchaseOrderSchema,
  updatePurchaseOrderSchema,
  updatePOStatusSchema,
  receiveReceiptSchema,
  createPOPaymentSchema,
} from './purchases.validator.js';

const router = Router();

// Secure all endpoints on purchases management
router.use(protect);
router.use(restrictTo('purchases.manage'));

router.get('/', purchasesController.getAll);
router.post('/', validate(createPurchaseOrderSchema), purchasesController.create);
router.get('/:id', validate(idParamSchema), purchasesController.getById);
router.patch('/:id', validate(updatePurchaseOrderSchema), purchasesController.update);
router.delete('/:id', validate(idParamSchema), purchasesController.delete);
router.patch('/:id/status', validate(updatePOStatusSchema), purchasesController.updateStatus);

router.post('/:id/receive', validate(receiveReceiptSchema), purchasesController.receiveReceipt);
router.post('/:id/payments', validate(createPOPaymentSchema), purchasesController.createPayment);

export default router;

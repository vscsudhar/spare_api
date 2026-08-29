import { Router } from 'express';
import suppliersController from './suppliers.controller.js';
import validate from '../../middlewares/validate.js';
import protect from '../../middlewares/auth.middleware.js';
import restrictTo from '../../middlewares/permission.middleware.js';
import {
  idParamSchema,
  createSupplierSchema,
  updateSupplierSchema,
  updateSupplierStatusSchema,
  createSupplierProductSchema,
  createSupplierPaymentSchema,
} from './suppliers.validator.js';

const router = Router();

// Secure all endpoints on supplier management
router.use(protect);
router.use(restrictTo('suppliers.manage'));

router.get('/', suppliersController.getAll);
router.post('/', validate(createSupplierSchema), suppliersController.create);
router.get('/:id', validate(idParamSchema), suppliersController.getById);
router.patch('/:id', validate(updateSupplierSchema), suppliersController.update);
router.delete('/:id', validate(idParamSchema), suppliersController.delete);
router.patch('/:id/status', validate(updateSupplierStatusSchema), suppliersController.updateStatus);

router.get('/:id/products', validate(idParamSchema), suppliersController.getProducts);
router.post('/:id/products', validate(createSupplierProductSchema), suppliersController.createProduct);

router.get('/:id/purchases', validate(idParamSchema), suppliersController.getPurchases);

router.get('/:id/payments', validate(idParamSchema), suppliersController.getPayments);
router.post('/:id/payments', validate(createSupplierPaymentSchema), suppliersController.createPayment);

export default router;

import { Router } from 'express';
import invoicesController from './invoices.controller.js';
import protect from '../../middlewares/auth.middleware.js';
import restrictTo from '../../middlewares/permission.middleware.js';
import validate from '../../middlewares/validate.js';
import { idParamSchema } from './invoices.validator.js';

const router = Router();
router.use(protect);

// Customer & Authorized User Routes
router.get('/order/:id', validate(idParamSchema), invoicesController.getOrderInvoice);
router.post('/order/:id', validate(idParamSchema), invoicesController.createOrderInvoice);
router.get('/:id', validate(idParamSchema), invoicesController.getInvoiceById);

// Admin Listing Route
router.get('/', restrictTo('billing.create', 'orders.read'), invoicesController.getAllInvoices);

export default router;

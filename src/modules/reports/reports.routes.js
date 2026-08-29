import { Router } from 'express';
import reportsController from './reports.controller.js';
import protect from '../../middlewares/auth.middleware.js';
import restrictTo from '../../middlewares/permission.middleware.js';

const router = Router();
router.use(protect);
router.use(restrictTo('reports.read'));

router.get('/sales', reportsController.getSales);
router.get('/orders', reportsController.getOrders);
router.get('/products', reportsController.getProducts);
router.get('/inventory', reportsController.getInventory);
router.get('/customers', reportsController.getCustomers);
router.get('/suppliers', reportsController.getSuppliers);
router.get('/purchases', reportsController.getPurchases);
router.get('/payments', reportsController.getPayments);
router.get('/rare-requests', reportsController.getRareRequests);
router.get('/ev-vs-petrol', reportsController.getEvVsPetrol);
router.get('/export', reportsController.exportCSV);
router.get('/dashboard-stats', reportsController.getDashboardStats);

export default router;

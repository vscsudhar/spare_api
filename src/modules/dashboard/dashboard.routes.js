import { Router } from 'express';
import dashboardController from './dashboard.controller.js';
import protect from '../../middlewares/auth.middleware.js';
import restrictTo from '../../middlewares/permission.middleware.js';

const router = Router();
router.use(protect);
router.use(restrictTo('dashboard.read'));

router.get('/summary', dashboardController.getSummary);
router.get('/recent-orders', dashboardController.getRecentOrders);
router.get('/low-stock', dashboardController.getLowStock);
router.get('/sales-chart', dashboardController.getSalesChart);
router.get('/quick-stats', dashboardController.getQuickStats);

export default router;

import { Router } from 'express';
import mongoose from 'mongoose';
import productsController from '../modules/products/products.controller.js';

// Module route imports
import authRoutes from '../modules/auth/auth.routes.js';
import usersRoutes from '../modules/users/users.routes.js';
import productsRoutes from '../modules/products/products.routes.js';
import categoriesRoutes from '../modules/categories/categories.routes.js';
import inventoryRoutes from '../modules/inventory/inventory.routes.js';
import suppliersRoutes from '../modules/suppliers/suppliers.routes.js';
import purchasesRoutes from '../modules/purchases/purchases.routes.js';
import customersRoutes from '../modules/customers/customers.routes.js';
import addressesRoutes from '../modules/addresses/addresses.routes.js';
import cartRoutes from '../modules/cart/cart.routes.js';
import wishlistRoutes from '../modules/wishlist/wishlist.routes.js';
import ordersRoutes, { checkoutRouter, adminOrdersRouter } from '../modules/orders/orders.routes.js';
import billingRoutes from '../modules/billing/billing.routes.js';
import rareRequestsRoutes, { adminRareRequestsRouter } from '../modules/rare-requests/rare-requests.routes.js';
import chatRoutes from '../modules/chat/chat.routes.js';
import quotationsRoutes from '../modules/quotations/quotations.routes.js';
import reportsRoutes from '../modules/reports/reports.routes.js';
import settingsRoutes from '../modules/settings/settings.routes.js';
import notificationsRoutes from '../modules/notifications/notifications.routes.js';
import uploadsRoutes from '../modules/uploads/uploads.routes.js';
import dashboardRoutes from '../modules/dashboard/dashboard.routes.js';
import supportTicketsRoutes from '../modules/support-tickets/support-tickets.routes.js';
import returnsRoutes from '../modules/returns/returns.routes.js';
import locationsRoutes from '../modules/locations/locations.routes.js';
import deliveryChargesRoutes from '../modules/delivery-charges/delivery-charges.routes.js';

const router = Router();

// Base health check routes
// @route   GET /api/v1/health
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is healthy and running',
    data: {
      uptime: process.uptime(),
      timestamp: Date.now(),
      status: 'UP',
    },
    meta: {},
  });
});

// @route   GET /api/v1/health/database
router.get('/health/database', (req, res) => {
  const dbStatus = mongoose.connection.readyState;
  let statusString = 'UNKNOWN';
  let isHealthy = false;

  switch (dbStatus) {
    case 0:
      statusString = 'DISCONNECTED';
      break;
    case 1:
      statusString = 'CONNECTED';
      isHealthy = true;
      break;
    case 2:
      statusString = 'CONNECTING';
      break;
    case 3:
      statusString = 'DISCONNECTING';
      break;
  }

  if (isHealthy) {
    res.status(200).json({
      success: true,
      message: 'Database connection is operational',
      data: {
        status: statusString,
        host: mongoose.connection.host,
        dbName: mongoose.connection.name,
      },
      meta: {},
    });
  } else {
    res.status(503).json({
      success: false,
      message: 'Database connection is offline or degrading',
      errors: [
        {
          code: 'DB_CONNECTION_FAILURE',
          message: `Database state is ${statusString}`,
        },
      ],
    });
  }
});

// Wire up modular feature routes
router.use('/auth', authRoutes);
router.use('/', usersRoutes);
router.use('/products', productsRoutes);
router.use('/categories', categoriesRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/suppliers', suppliersRoutes);
router.use('/purchases', purchasesRoutes);

// Vehicle Brands and Models mapping
router.get('/vehicle-brands', productsController.getVehicleBrands);
router.post('/vehicle-brands', productsController.createVehicleBrand);
router.patch('/vehicle-brands/:id', productsController.updateVehicleBrand);
router.get('/vehicle-models', productsController.getVehicleModels);
router.post('/vehicle-models', productsController.createVehicleModel);
router.patch('/vehicle-models/:id', productsController.updateVehicleModel);
router.use('/customers', customersRoutes);
router.use('/addresses', addressesRoutes);
router.use('/cart', cartRoutes);
router.use('/wishlist', wishlistRoutes);
router.use('/orders', ordersRoutes);
router.use('/checkout', checkoutRouter);
router.use('/admin/orders', adminOrdersRouter);
router.use('/admin/dashboard', dashboardRoutes);
router.use('/billing', billingRoutes);
router.use('/pos', billingRoutes);
router.use('/rare-requests', rareRequestsRoutes);
router.use('/admin/rare-requests', adminRareRequestsRouter);
router.use('/chat', chatRoutes);
router.use('/quotations', quotationsRoutes);
router.use('/reports', reportsRoutes);
router.use('/settings', settingsRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/uploads', uploadsRoutes);
router.use('/support-tickets', supportTicketsRoutes);
router.use('/returns', returnsRoutes);
router.use('/admin/locations', locationsRoutes);
router.use('/locations', locationsRoutes);
router.use('/delivery-charges', deliveryChargesRoutes);

export default router;

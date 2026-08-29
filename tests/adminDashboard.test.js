import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app.js';
import { connectDB } from '../src/config/db.js';
import { seedDatabase } from '../src/database/seed.js';
import { cleanDatabase } from './cleanup.js';
import { Notifications } from '../src/modules/notifications/notifications.model.js';

describe('Admin Dashboard, Reports, Settings, Notifications, & Profile API Tests', () => {
  let ownerToken;
  let customerToken;
  let notificationId;

  beforeAll(async () => {
    await connectDB();
    await cleanDatabase();
    await seedDatabase(false);

    // 1. Login owner
    const loginRes = await request(app).post('/api/v1/auth/admin/login').send({
      email: process.env.OWNER_EMAIL,
      password: process.env.OWNER_PASSWORD,
    });
    ownerToken = loginRes.body.data.accessToken;

    // 2. Register and Login Customer
    await request(app).post('/api/v1/auth/customer/register').send({
      name: 'Customer Dashboard',
      email: 'customer.dash@test.com',
      phone: '+919876543211',
      password: 'P@ssword123!',
    });
    const logRes = await request(app).post('/api/v1/auth/customer/login').send({
      email: 'customer.dash@test.com',
      password: 'P@ssword123!',
    });
    customerToken = logRes.body.data.accessToken;
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('Settings API Enforcements', () => {
    it('should seed default Settings doc and retrieve via GET /settings', async () => {
      const res = await request(app)
        .get('/api/v1/settings')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.general.appName).toEqual('VoltSpare');
      expect(res.body.data.pos.allowSplitPayment).toBe(true);
    });

    it('should allow owner to update general settings', async () => {
      const res = await request(app)
        .patch('/api/v1/settings/general')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          appName: 'VoltSpare Pro',
          supportEmail: 'pro-support@voltspare.com',
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.general.appName).toEqual('VoltSpare Pro');
      expect(res.body.data.general.supportEmail).toEqual('pro-support@voltspare.com');
    });

    it('should validate split payment constraints inside POS settings', async () => {
      // Trying to configure invalid maxSplitMethods (boundary: < 1)
      const res = await request(app)
        .patch('/api/v1/settings/pos')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          maxSplitMethods: 0,
        });

      expect(res.statusCode).toEqual(400);
    });

    it('should allow owner to update POS split payment boundaries successfully', async () => {
      const res = await request(app)
        .patch('/api/v1/settings/pos')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          allowSplitPayment: true,
          minSplitAmount: 5000, // ₹50.00
          maxSplitMethods: 2,
          paymentMethods: ['cash', 'upi'],
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.pos.minSplitAmount).toEqual(5000);
      expect(res.body.data.pos.maxSplitMethods).toEqual(2);
    });

    it('should allow owner to update theme preference inside appearance settings', async () => {
      const res = await request(app)
        .patch('/api/v1/settings/appearance')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          theme: 'dark',
          sidebarMode: 'collapsed',
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.appearance.theme).toEqual('dark');
    });
  });

  describe('User Profile API Updates', () => {
    it('should allow own profile retrieval', async () => {
      const res = await request(app)
        .get('/api/v1/users/profile')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.email).toEqual('customer.dash@test.com');
    });

    it('should allow updating personal profile details', async () => {
      const res = await request(app)
        .put('/api/v1/users/profile')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          name: 'Dashboard Champion',
          phone: '+919999988888',
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.name).toEqual('Dashboard Champion');
      expect(res.body.data.phone).toEqual('+919999988888');
    });
  });

  describe('Dashboard stats aggregates (REST)', () => {
    it('should retrieve overall dashboard summary metrics', async () => {
      const res = await request(app)
        .get('/api/v1/admin/dashboard/summary')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data).toHaveProperty('revenue');
      expect(res.body.data).toHaveProperty('orders');
      expect(res.body.data).toHaveProperty('customers');
      expect(res.body.data).toHaveProperty('products');
    });

    it('should retrieve recent orders list', async () => {
      const res = await request(app)
        .get('/api/v1/admin/dashboard/recent-orders')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should retrieve sales trend chart data', async () => {
      const res = await request(app)
        .get('/api/v1/admin/dashboard/sales-chart?range=daily')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should retrieve quick statistics summary counts', async () => {
      const res = await request(app)
        .get('/api/v1/admin/dashboard/quick-stats')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data).toHaveProperty('pendingOrders');
      expect(res.body.data).toHaveProperty('lowStock');
      expect(res.body.data).toHaveProperty('supplierDues');
    });
  });

  describe('Reports aggregation pipelines', () => {
    it('should retrieve sales report statistics', async () => {
      const res = await request(app)
        .get('/api/v1/reports/sales?groupBy=daily')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should retrieve orders status report', async () => {
      const res = await request(app)
        .get('/api/v1/reports/orders')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should retrieve top selling products report', async () => {
      const res = await request(app)
        .get('/api/v1/reports/products')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should retrieve EV vs Petrol vehicle components comparison report', async () => {
      const res = await request(app)
        .get('/api/v1/reports/ev-vs-petrol')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should allow exporting sales report data as downloadable CSV', async () => {
      const res = await request(app)
        .get('/api/v1/reports/export?type=sales')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toBeDefined();
    });
  });

  describe('Notifications alerts triggers & API', () => {
    beforeAll(async () => {
      // Pre-seed an administrative alert notification manually
      const notif = await Notifications.create({
        user: null, // global admin notification
        title: 'Manual Stock Level Sourcing Alert',
        message: 'A low stock level trigger notification',
        type: 'low_stock',
      });
      notificationId = notif._id;
    });

    it('should fetch unread notifications count', async () => {
      const res = await request(app)
        .get('/api/v1/notifications/unread-count')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.count).toBeGreaterThanOrEqual(1);
    });

    it('should mark specific notification as read', async () => {
      const res = await request(app)
        .patch(`/api/v1/notifications/${notificationId}/read`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.read).toBe(true);
    });

    it('should mark all notifications as read', async () => {
      const res = await request(app)
        .patch('/api/v1/notifications/read-all')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.statusCode).toEqual(200);
    });

    it('should delete notification by ID', async () => {
      const res = await request(app)
        .delete(`/api/v1/notifications/${notificationId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.statusCode).toEqual(200);
    });
  });
});

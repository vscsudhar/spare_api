import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app.js';
import { connectDB } from '../src/config/db.js';
import { seedDatabase } from '../src/database/seed.js';
import { cleanDatabase } from './cleanup.js';
import Products from '../src/modules/products/products.model.js';
import Categories from '../src/modules/categories/categories.model.js';
import Users from '../src/modules/users/users.model.js';
import Role from '../src/modules/users/roles.model.js';

describe('Orders, Checkout & Shopping Flow Integration Tests', () => {
  let ownerToken;
  let customerAToken;
  let customerBToken;
  let testProductId;
  let addressId;
  let testOrderId;
  let deliveryStaffId;
  let categoryId;

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

    // 2. Register and Login Customer A (with strong password)
    await request(app).post('/api/v1/auth/customer/register').send({
      name: 'Customer A',
      email: 'customer.a@test.com',
      phone: '+919876543210',
      password: 'P@ssword123!',
    });
    const logARes = await request(app).post('/api/v1/auth/customer/login').send({
      email: 'customer.a@test.com',
      password: 'P@ssword123!',
    });
    customerAToken = logARes.body.data.accessToken;

    // 3. Register and Login Customer B (with strong password)
    await request(app).post('/api/v1/auth/customer/register').send({
      name: 'Customer B',
      email: 'customer.b@test.com',
      phone: '+919876543211',
      password: 'P@ssword123!',
    });
    const logBRes = await request(app).post('/api/v1/auth/customer/login').send({
      email: 'customer.b@test.com',
      password: 'P@ssword123!',
    });
    customerBToken = logBRes.body.data.accessToken;

    // 4. Create a delivery staff user
    const deliveryRole = await Role.findOne({ name: 'delivery_staff' });
    const driver = await Users.create({
      name: 'Delivery Rider',
      email: 'delivery.rider@test.com',
      phone: '+919999988888',
      passwordHash: 'mock-hash',
      role: deliveryRole._id,
      status: 'active',
    });
    deliveryStaffId = driver._id;

    // 5. Fetch a product ID and Category ID for tests
    const prd = await Products.findOne({ sku: 'ATH-DRV-BLT' });
    testProductId = prd._id;

    const cat = await Categories.findOne({ name: 'Brakes' });
    categoryId = cat._id;
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('Customer Address & Wishlist flow', () => {
    it('should create an address for Customer A', async () => {
      const res = await request(app)
        .post('/api/v1/addresses')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          name: 'Home',
          recipientName: 'Customer A',
          phone: '+919876543210',
          addressLine1: 'Flat 402, Block A',
          addressLine2: 'Volt Park View',
          city: 'Bangalore',
          state: 'Karnataka',
          postalCode: '560001',
          isDefault: true,
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body.data.isDefault).toBe(true);
      addressId = res.body.data._id;
    });

    it('should retrieve Customer A address list', async () => {
      const res = await request(app)
        .get('/api/v1/addresses')
        .set('Authorization', `Bearer ${customerAToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.length).toEqual(1);
    });

    it('should manage Customer A wishlist', async () => {
      // Add to wishlist
      let res = await request(app)
        .post(`/api/v1/wishlist/${testProductId}`)
        .set('Authorization', `Bearer ${customerAToken}`);
      expect(res.statusCode).toEqual(200);
      expect(res.body.data.products.length).toEqual(1);

      // Get wishlist
      res = await request(app)
        .get('/api/v1/wishlist')
        .set('Authorization', `Bearer ${customerAToken}`);
      expect(res.statusCode).toEqual(200);
      expect(res.body.data.products[0]._id).toEqual(testProductId.toString());

      // Remove from wishlist
      res = await request(app)
        .delete(`/api/v1/wishlist/${testProductId}`)
        .set('Authorization', `Bearer ${customerAToken}`);
      expect(res.statusCode).toEqual(200);
      expect(res.body.data.products.length).toEqual(0);
    });
  });

  describe('Customer Cart & Checkout Validate Flow', () => {
    it('should manage Customer A cart and apply coupon', async () => {
      // Add item to cart
      let res = await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          productId: testProductId,
          quantity: 2,
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.items.length).toEqual(1);
      expect(res.body.data.items[0].quantity).toEqual(2);

      // Apply coupon code SAVE10 (percentage, value 10%, max discount capped at 200)
      res = await request(app)
        .post('/api/v1/cart/apply-coupon')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          code: 'SAVE10',
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.coupon.code).toEqual('SAVE10');
    });

    it('should validate checkout totals correctly', async () => {
      const res = await request(app)
        .post('/api/v1/checkout/validate')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          addressId,
        });

      expect(res.statusCode).toEqual(200);
      // Ather belt price: 1500 * 2 = 3000 subTotal. Tax is 18% = 540.
      // Coupon discount is 10% on 3000 = 300, capped at 200 by maxDiscountAmount.
      // SubTotal > 1000, so deliveryFee = 0.
      // GrandTotal = 3000 + 540 + 0 - 200 = 3340.
      expect(res.body.data.subTotal).toEqual(3000);
      expect(res.body.data.taxAmount).toEqual(540);
      expect(res.body.data.discountAmount).toEqual(200);
      expect(res.body.data.grandTotal).toEqual(3340);
    });
  });

  describe('Checkout & Idempotency Duplicate Protection', () => {
    it('should place an order and verify stock deduction and cart clearance', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerAToken}`)
        .set('X-Idempotency-Key', 'idemp-key-100')
        .send({
          addressId,
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body.data.grandTotal).toEqual(3340);
      expect(res.body.data.status).toEqual('pending');
      testOrderId = res.body.data._id;

      // Verify product stock reduced from 25 to 23
      const product = await Products.findById(testProductId);
      expect(product.currentStock).toEqual(23);

      // Verify cart cleared
      const cartRes = await request(app)
        .get('/api/v1/cart')
        .set('Authorization', `Bearer ${customerAToken}`);
      expect(cartRes.body.data.items.length).toEqual(0);
    });

    it('should intercept identical checkout with idempotency key and return existing order details', async () => {
      // Trigger checkout again using same key
      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerAToken}`)
        .set('X-Idempotency-Key', 'idemp-key-100')
        .send({
          addressId,
        });

      // Returns 201 (or 200) with same order details
      expect(res.statusCode).toEqual(201);
      expect(res.body.data._id).toEqual(testOrderId);

      // Verify product stock remains exactly 23 (no duplicate deduction)
      const product = await Products.findById(testProductId);
      expect(product.currentStock).toEqual(23);
    });
  });

  describe('Customer Cancel & Stock Restore Flow', () => {
    it('should allow customer to cancel order and restore inventory', async () => {
      const res = await request(app)
        .post(`/api/v1/orders/${testOrderId}/cancel`)
        .set('Authorization', `Bearer ${customerAToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.status).toEqual('cancelled');

      // Verify stock restored from 23 to 25
      const product = await Products.findById(testProductId);
      expect(product.currentStock).toEqual(25);
    });
  });

  describe('Admin Order Management', () => {
    let adminOrderId;

    beforeAll(async () => {
      // Repopulate Customer A cart and place a new order for admin testing
      await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          productId: testProductId,
          quantity: 1,
        });
      const orderRes = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          addressId,
        });
      adminOrderId = orderRes.body.data._id;
    });

    it('should allow admin to update order status', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/orders/${adminOrderId}/status`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          status: 'confirmed',
          notes: 'Inventory verification passed',
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.status).toEqual('confirmed');
      expect(res.body.data.statusHistory.length).toBeGreaterThanOrEqual(2);
    });

    it('should allow admin to assign a delivery driver', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/orders/${adminOrderId}/assign-delivery`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          driverId: deliveryStaffId,
          notes: 'Standard dispatch notes',
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.deliveryAssignment.driver).toEqual(deliveryStaffId.toString());
      expect(res.body.data.deliveryAssignment.status).toEqual('assigned');
    });

    it('should allow admin to log internal notes', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/orders/${adminOrderId}/notes`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          text: 'Internal flag check: package details confirmed.',
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.notes.length).toEqual(1);
      expect(res.body.data.notes[0].text).toEqual('Internal flag check: package details confirmed.');
    });
  });

  describe('Concurrent Stock Requests Concurrency Safety', () => {
    let concurrentProductId;
    let custAAddressId;
    let custBAddressId;

    beforeAll(async () => {
      // 1. Create a product with limited stock = 3
      const product = await Products.create({
        sku: 'LIMIT-STK-01',
        name: 'Limited Caliper Bolt',
        slug: 'limited-caliper-bolt',
        brand: 'Honda',
        category: categoryId,
        sellingPrice: 100,
        mrp: 120,
        purchasePrice: 60,
        currentStock: 3,
        active: true,
      });
      concurrentProductId = product._id;

      // 2. Set up addresses for Customer A & B
      const addrA = await request(app)
        .post('/api/v1/addresses')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          name: 'Home A',
          recipientName: 'Customer A',
          phone: '+919876543210',
          addressLine1: 'Address A',
          city: 'Bangalore',
          state: 'Karnataka',
          postalCode: '560001',
        });
      custAAddressId = addrA.body.data._id;

      const addrB = await request(app)
        .post('/api/v1/addresses')
        .set('Authorization', `Bearer ${customerBToken}`)
        .send({
          name: 'Home B',
          recipientName: 'Customer B',
          phone: '+919876543211',
          addressLine1: 'Address B',
          city: 'Bangalore',
          state: 'Karnataka',
          postalCode: '560001',
        });
      custBAddressId = addrB.body.data._id;

      // 3. Customer A adds 2 units to cart (stock is 3)
      await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          productId: concurrentProductId,
          quantity: 2,
        });

      // 4. Customer B adds 2 units to cart (stock is 3)
      await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${customerBToken}`)
        .send({
          productId: concurrentProductId,
          quantity: 2,
        });
    });

    it('should prevent negative stock allocations under concurrent checkouts', async () => {
      // Trigger checkout orders concurrently
      const checkouts = [
        request(app)
          .post('/api/v1/orders')
          .set('Authorization', `Bearer ${customerAToken}`)
          .send({ addressId: custAAddressId }),
        request(app)
          .post('/api/v1/orders')
          .set('Authorization', `Bearer ${customerBToken}`)
          .send({ addressId: custBAddressId }),
      ];

      const results = await Promise.all(checkouts);

      const statusCodes = results.map((r) => r.statusCode);
      // One request MUST succeed (201) and the other MUST fail with a conflict/insufficient stock error (400)
      expect(statusCodes).toContain(201);
      expect(statusCodes).toContain(400);

      // Verify product stock drops exactly to 1, and NEVER goes negative to -1!
      const product = await Products.findById(concurrentProductId);
      expect(product.currentStock).toEqual(1);
    });
  });
});

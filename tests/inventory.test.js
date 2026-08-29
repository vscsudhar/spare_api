import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app.js';
import { connectDB } from '../src/config/db.js';
import { seedDatabase } from '../src/database/seed.js';
import { cleanDatabase } from './cleanup.js';
import Products from '../src/modules/products/products.model.js';
import { InventoryItem } from '../src/modules/inventory/inventory.model.js';

describe('Inventory Module Integration Tests', () => {
  let ownerToken;
  let testProduct;

  beforeAll(async () => {
    await connectDB();
    await cleanDatabase();
    await seedDatabase(false);

    // Login owner to get authorization token
    const loginRes = await request(app).post('/api/v1/auth/admin/login').send({
      email: process.env.OWNER_EMAIL,
      password: process.env.OWNER_PASSWORD,
    });
    ownerToken = loginRes.body.data.accessToken;

    testProduct = await Products.findOne({ sku: 'ATH-DRV-BLT' });
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('GET /api/v1/inventory and summary', () => {
    it('should retrieve inventory items', async () => {
      const res = await request(app)
        .get('/api/v1/inventory')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('should calculate inventory summary correctly', async () => {
      const res = await request(app)
        .get('/api/v1/inventory/summary')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.totalStock).toBeGreaterThan(0);
      expect(res.body.data.totalValue).toBeGreaterThan(0);
    });
  });

  describe('POST /api/v1/inventory/adjustments', () => {
    it('should adjust product stock (auditable change)', async () => {
      // Current stock is 25. Let's add 5.
      const res = await request(app)
        .post('/api/v1/inventory/adjustments')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          productId: testProduct._id,
          quantity: 5,
          reason: 'Received sample units',
        });

      expect(res.statusCode).toEqual(201);

      // Verify Product and InventoryItem stocks are synced to 30
      const updatedProduct = await Products.findById(testProduct._id);
      expect(updatedProduct.currentStock).toEqual(30);

      const invItem = await InventoryItem.findOne({ product: testProduct._id });
      expect(invItem.currentStock).toEqual(30);
    });

    it('should log stock movements for the adjustment', async () => {
      const res = await request(app)
        .get(`/api/v1/inventory/${testProduct._id}/movements`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      // The first movement should be 'adjustment'
      expect(res.body.data[0].type).toEqual('adjustment');
      expect(res.body.data[0].quantity).toEqual(5);
    });

    it('should reject adjustments resulting in negative stock', async () => {
      const res = await request(app)
        .post('/api/v1/inventory/adjustments')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          productId: testProduct._id,
          quantity: -50, // Insufficient stock (currently 30)
          reason: 'Damage scrap',
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toContain('Insufficient stock');
    });
  });
});

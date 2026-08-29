import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app.js';
import { connectDB } from '../src/config/db.js';
import { seedDatabase } from '../src/database/seed.js';
import { cleanDatabase } from './cleanup.js';
import Products from '../src/modules/products/products.model.js';
import Categories from '../src/modules/categories/categories.model.js';

describe('Products & Catalog Integration Tests', () => {
  let ownerToken;
  let testProductId;
  let categoryId;

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

    const cat = await Categories.findOne({ name: 'Brakes' });
    categoryId = cat._id;
  });

  afterAll(async () => {
    if (testProductId) {
      await Products.deleteOne({ _id: testProductId });
    }
    await mongoose.connection.close();
  });

  describe('GET /api/v1/products', () => {
    it('should retrieve list of products with pagination defaults', async () => {
      const res = await request(app).get('/api/v1/products');
      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.meta).toHaveProperty('total');
    });

    it('should filter products by EV type', async () => {
      const res = await request(app).get('/api/v1/products?type=EV');
      expect(res.statusCode).toEqual(200);
      const allEVOrUniversal = res.body.data.every((prd) => prd.sku !== 'ACT-AIR-FLT');
      expect(allEVOrUniversal).toBe(true);
    });

    it('should filter products by Petrol type', async () => {
      const res = await request(app).get('/api/v1/products?type=Petrol');
      expect(res.statusCode).toEqual(200);
      // Petrol type filter should not return Ather (EV) product
      const hasEVProduct = res.body.data.some((prd) => prd.sku === 'ATH-DRV-BLT');
      expect(hasEVProduct).toBe(false);
    });
  });

  describe('GET /api/v1/products/search', () => {
    it('should find products by text query search', async () => {
      const res = await request(app).get('/api/v1/products/search?q=Ather');
      expect(res.statusCode).toEqual(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].name).toContain('Ather');
    });
  });

  describe('GET /api/v1/vehicle-brands and models', () => {
    it('should return vehicle brands catalog', async () => {
      const res = await request(app).get('/api/v1/vehicle-brands');
      expect(res.statusCode).toEqual(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('should return vehicle models catalog', async () => {
      const res = await request(app).get('/api/v1/vehicle-models');
      expect(res.statusCode).toEqual(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('Administrative Product Actions', () => {
    it('should create a product', async () => {
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          sku: 'TEST-SKU-99',
          name: 'Test Brake Caliper',
          brand: 'Brembo',
          category: categoryId,
          sellingPrice: 1200,
          mrp: 1500,
          purchasePrice: 800,
          active: true,
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body.data.sku).toEqual('TEST-SKU-99');
      testProductId = res.body.data._id;
    });

    it('should update product status', async () => {
      const res = await request(app)
        .patch(`/api/v1/products/${testProductId}/status`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          active: false,
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.active).toBe(false);
    });

    it('should soft delete product', async () => {
      const res = await request(app)
        .delete(`/api/v1/products/${testProductId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.statusCode).toEqual(200);

      // Verify product is soft deleted (not visible in list)
      const listRes = await request(app).get('/api/v1/products');
      const inList = listRes.body.data.some((prd) => prd._id === testProductId);
      expect(inList).toBe(false);
    });
  });
});

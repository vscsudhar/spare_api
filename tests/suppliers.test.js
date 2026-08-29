import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app.js';
import { connectDB } from '../src/config/db.js';
import { seedDatabase } from '../src/database/seed.js';
import { cleanDatabase } from './cleanup.js';
import Products from '../src/modules/products/products.model.js';
import Supplier from '../src/modules/suppliers/suppliers.model.js';

describe('Suppliers Module Integration Tests', () => {
  let ownerToken;
  let testProductId;
  let testSupplierId;

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

    const prd = await Products.findOne({ sku: 'ATH-DRV-BLT' });
    testProductId = prd._id;

    // Clean up test supplier if any
    await Supplier.deleteOne({ code: 'SUPP-TEST' });
  });

  afterAll(async () => {
    await Supplier.deleteOne({ code: 'SUPP-TEST' });
    await mongoose.connection.close();
  });

  describe('Suppliers CRUD Management', () => {
    it('should create a supplier profile', async () => {
      const res = await request(app)
        .post('/api/v1/suppliers')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Test Automotive Industries',
          code: 'SUPP-TEST',
          email: 'test@automotive.com',
          phone: '+919999900000',
          gstNumber: '29AAAAA1111A1Z1',
          bankDetails: {
            bankName: 'HDFC Bank',
            accountNumber: '123456789012',
            ifscCode: 'HDFC0000123',
            accountName: 'Test Automotive Industries',
          },
          upiId: 'testauto@upi',
          creditLimit: 50000,
          paymentTerms: 'Net 30',
          vehicleCategories: ['EV', 'Universal'],
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body.data.code).toEqual('SUPP-TEST');
      expect(res.body.data.outstandingBalance).toEqual(0);
      testSupplierId = res.body.data._id;
    });

    it('should retrieve list of suppliers', async () => {
      const res = await request(app)
        .get('/api/v1/suppliers')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('Supplier Product Mapping', () => {
    it('should map a product to the supplier', async () => {
      const res = await request(app)
        .post(`/api/v1/suppliers/${testSupplierId}/products`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          productId: testProductId,
          supplierSku: 'SUPP-ATH-DRV',
          lastPurchasePrice: 950,
        });

      expect(res.statusCode).toEqual(201);

      // Verify mapping is retrievable
      const listRes = await request(app)
        .get(`/api/v1/suppliers/${testSupplierId}/products`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(listRes.statusCode).toEqual(200);
      expect(listRes.body.data.length).toEqual(1);
      expect(listRes.body.data[0].product._id).toEqual(testProductId.toString());
    });
  });

  describe('Supplier Payments outstanding balance mapping', () => {
    it('should apply payments and reduce outstanding balance', async () => {
      // Artificially increase outstanding balance (simulate PO receipt)
      const supplier = await Supplier.findById(testSupplierId);
      supplier.outstandingBalance = 5000;
      await supplier.save();

      // Log payment of 2000
      const res = await request(app)
        .post(`/api/v1/suppliers/${testSupplierId}/payments`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          amount: 2000,
          paymentMethod: 'upi',
          transactionReference: 'TXN-999888',
          notes: 'Partial payment against inventory receipt',
        });

      expect(res.statusCode).toEqual(201);

      // Verify balance is now 3000
      const updatedSupplier = await Supplier.findById(testSupplierId);
      expect(updatedSupplier.outstandingBalance).toEqual(3000);
    });
  });
});

import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app.js';
import { connectDB } from '../src/config/db.js';
import { seedDatabase } from '../src/database/seed.js';
import { cleanDatabase } from './cleanup.js';
import Products from '../src/modules/products/products.model.js';
import Supplier from '../src/modules/suppliers/suppliers.model.js';
import PurchaseOrder, { PurchaseReceipt } from '../src/modules/purchases/purchases.model.js';

describe('Purchases Module Integration Tests', () => {
  let ownerToken;
  let testProductId;
  let testSupplierId;
  let testPoId;

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

    // Create a supplier to use in PO
    const supp = await Supplier.create({
      name: 'Purchase Test Vendor',
      code: 'TEST-VEND-1',
      email: 'test@vendor.com',
      phone: '+919999911111',
      outstandingBalance: 0,
    });
    testSupplierId = supp._id;
  });

  afterAll(async () => {
    await Supplier.deleteOne({ _id: testSupplierId });
    if (testPoId) {
      await PurchaseOrder.deleteOne({ _id: testPoId });
      await PurchaseReceipt.deleteOne({ purchaseOrder: testPoId });
    }
    await mongoose.connection.close();
  });

  describe('Purchase Order lifecycle', () => {
    it('should create a purchase order in draft status', async () => {
      const res = await request(app)
        .post('/api/v1/purchases')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          supplier: testSupplierId,
          items: [
            {
              product: testProductId,
              quantity: 10,
              unitPrice: 1000,
              taxPercentage: 18,
            },
          ],
          notes: 'Regular replenishment PO',
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body.data.status).toEqual('draft');
      expect(res.body.data.grandTotal).toEqual(11800); // 10000 + 1800 tax
      testPoId = res.body.data._id;
    });

    it('should update PO status to ordered', async () => {
      const res = await request(app)
        .patch(`/api/v1/purchases/${testPoId}/status`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          status: 'ordered',
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.status).toEqual('ordered');
    });

    it('should reject receiving excess quantity', async () => {
      const res = await request(app)
        .post(`/api/v1/purchases/${testPoId}/receive`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          items: [
            {
              product: testProductId,
              quantityReceived: 15, // Ordered only 10
            },
          ],
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toContain('remaining to be received');
    });

    it('should receive partial/complete PO items and increase inventory/payables', async () => {
      // Current stock is 25. Let's receive 5 units.
      const res = await request(app)
        .post(`/api/v1/purchases/${testPoId}/receive`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          items: [
            {
              product: testProductId,
              quantityReceived: 5,
            },
          ],
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body.data.receiptNumber).toBeDefined();

      // Verify PO status transitioned to partially_received
      const updatedPo = await PurchaseOrder.findById(testPoId);
      expect(updatedPo.status).toEqual('partially_received');
      expect(updatedPo.items[0].quantityReceived).toEqual(5);

      // Verify Product stock increased: 25 (opening) + 5 (received) = 30
      const updatedProduct = await Products.findById(testProductId);
      expect(updatedProduct.currentStock).toEqual(30);

      // Verify Supplier outstanding balance increased: 5 * 1000 * 1.18 = 5900
      const updatedSupplier = await Supplier.findById(testSupplierId);
      expect(updatedSupplier.outstandingBalance).toEqual(5900);
    });

    it('should record payment on PO and reduce supplier balance', async () => {
      // Pay 3000 against this PO
      const res = await request(app)
        .post(`/api/v1/purchases/${testPoId}/payments`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          amount: 3000,
          paymentMethod: 'bank_transfer',
          transactionReference: 'PO-PAY-111222',
          notes: 'Advanced payment for PO receipt',
        });

      expect(res.statusCode).toEqual(201);

      // Verify Supplier outstanding balance reduced: 5900 - 3000 = 2900
      const updatedSupplier = await Supplier.findById(testSupplierId);
      expect(updatedSupplier.outstandingBalance).toEqual(2900);
    });
  });
});

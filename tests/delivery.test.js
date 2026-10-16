import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app.js';
import { connectDB } from '../src/config/db.js';
import { seedDatabase } from '../src/database/seed.js';
import { cleanDatabase } from './cleanup.js';
import Users from '../src/modules/users/users.model.js';
import Role from '../src/modules/users/roles.model.js';
import Order from '../src/modules/orders/orders.model.js';
import Products from '../src/modules/products/products.model.js';
import bcrypt from 'bcryptjs';

describe('Delivery Partner API Integration Tests', () => {
  let driverUser;
  let driverToken;
  let customerToken;
  let sampleOrder;

  beforeAll(async () => {
    await connectDB();
    await cleanDatabase();
    await seedDatabase(false);

    // 1. Create delivery staff user
    const deliveryRole = await Role.findOne({ name: 'delivery_staff' });
    const passwordHash = await bcrypt.hash('Driver@123', 10);
    driverUser = await Users.create({
      name: 'Ramesh Rider',
      email: 'ramesh.delivery@voltspare.com',
      phone: '+919876500001',
      passwordHash,
      role: deliveryRole._id,
      status: 'active',
    });

    // 2. Login driver
    const driverLoginRes = await request(app).post('/api/v1/auth/admin/login').send({
      email: 'ramesh.delivery@voltspare.com',
      password: 'Driver@123',
    });
    driverToken = driverLoginRes.body.data.accessToken;

    // 3. Register and Login Customer
    await request(app).post('/api/v1/auth/customer/register').send({
      name: 'Suresh Customer',
      email: 'suresh@customer.com',
      phone: '+919876500002',
      password: 'P@ssword123!',
    });
    const custLoginRes = await request(app).post('/api/v1/auth/customer/login').send({
      email: 'suresh@customer.com',
      password: 'P@ssword123!',
    });
    customerToken = custLoginRes.body.data.accessToken;

    // 4. Create sample order assigned to driver
    const customer = await Users.findOne({ email: 'suresh@customer.com' });
    const product = await Products.findOne();

    sampleOrder = await Order.create({
      orderNumber: 'ORD-DEL-1001',
      user: customer._id,
      items: [
        {
          product: product._id,
          productSnapshot: {
            name: product.name,
            sku: product.sku,
            slug: product.slug,
            sellingPrice: product.sellingPrice,
            purchasePrice: product.purchasePrice,
            mrp: product.mrp,
          },
          quantity: 2,
          unitPrice: product.sellingPrice,
          totalPrice: product.sellingPrice * 2,
        },
      ],
      shippingAddress: {
        recipientName: 'Suresh Customer',
        phone: '+919876500002',
        addressLine1: 'No 45, Greenways Road',
        addressLine2: 'Near Metro',
        city: 'Chennai',
        state: 'Tamil Nadu',
        postalCode: '600028',
        country: 'India',
        latitude: 13.0284,
        longitude: 80.2541,
      },
      grandTotal: 150000, // Rs 1,500.00
      subTotal: 150000,
      paymentMethod: 'Cash on Delivery',
      paymentStatus: 'unpaid',
      status: 'processing',
      deliveryAssignment: {
        driver: driverUser._id,
        status: 'assigned',
        assignedAt: new Date(),
      },
      statusHistory: [{ status: 'processing', notes: 'Order assigned to driver' }],
    });
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  it('should reject unauthorized customer role from delivery endpoints', async () => {
    const res = await request(app)
      .get('/api/v1/delivery/dashboard')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.statusCode).toEqual(403);
  });

  it('should return dashboard summary for delivery partner', async () => {
    const res = await request(app)
      .get('/api/v1/delivery/dashboard?period=daily')
      .set('Authorization', `Bearer ${driverToken}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.data.openDeliveries).toBeGreaterThanOrEqual(1);
    expect(res.body.data.collectedAmount).toEqual(0);
  });

  it('should list assigned orders for delivery partner', async () => {
    const res = await request(app)
      .get('/api/v1/delivery/orders?status=open')
      .set('Authorization', `Bearer ${driverToken}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.data.orders.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.orders[0].orderNumber).toEqual('ORD-DEL-1001');
    expect(res.body.data.orders[0].shippingAddress.latitude).toEqual(13.0284);
  });

  it('should get single order details by id', async () => {
    const res = await request(app)
      .get(`/api/v1/delivery/orders/${sampleOrder._id}`)
      .set('Authorization', `Bearer ${driverToken}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.data.orderNumber).toEqual('ORD-DEL-1001');
  });

  it('should update delivery status to in_transit', async () => {
    const res = await request(app)
      .patch(`/api/v1/delivery/orders/${sampleOrder._id}/status`)
      .set('Authorization', `Bearer ${driverToken}`)
      .send({
        status: 'in_transit',
        notes: 'Out for customer delivery',
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body.data.status).toEqual('in_transit');
    expect(res.body.data.deliveryAssignment.status).toEqual('picked_up');
  });

  it('should reject marking unpaid COD order as delivered without payment', async () => {
    const res = await request(app)
      .patch(`/api/v1/delivery/orders/${sampleOrder._id}/status`)
      .set('Authorization', `Bearer ${driverToken}`)
      .send({
        status: 'delivered',
      });

    expect(res.statusCode).toEqual(400);
    expect(res.body.message || res.body.errors?.[0]?.message).toContain('COD payment must be collected first');
  });

  it('should successfully record COD payment collection', async () => {
    const res = await request(app)
      .post(`/api/v1/delivery/orders/${sampleOrder._id}/collect-payment`)
      .set('Authorization', `Bearer ${driverToken}`)
      .send({
        paymentMethod: 'Cash on Delivery',
        notes: 'Cash received from customer',
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body.data.payment.amount).toEqual(150000);
    expect(res.body.data.order.paymentStatus).toEqual('paid');
  });

  it('should prevent duplicate payment collection for the same order', async () => {
    const res = await request(app)
      .post(`/api/v1/delivery/orders/${sampleOrder._id}/collect-payment`)
      .set('Authorization', `Bearer ${driverToken}`)
      .send({
        paymentMethod: 'Cash on Delivery',
      });

    expect(res.statusCode).toEqual(400);
  });

  it('should allow marking order as delivered after payment is collected', async () => {
    const res = await request(app)
      .patch(`/api/v1/delivery/orders/${sampleOrder._id}/status`)
      .set('Authorization', `Bearer ${driverToken}`)
      .send({
        status: 'delivered',
        notes: 'Handed to customer',
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body.data.status).toEqual('delivered');
  });

  it('should return updated dashboard metrics and collection history', async () => {
    const summaryRes = await request(app)
      .get('/api/v1/delivery/dashboard?period=daily')
      .set('Authorization', `Bearer ${driverToken}`);

    expect(summaryRes.statusCode).toEqual(200);
    expect(summaryRes.body.data.completedDeliveries).toBeGreaterThanOrEqual(1);
    expect(summaryRes.body.data.collectedAmount).toEqual(150000);

    const collRes = await request(app)
      .get('/api/v1/delivery/collections?period=daily')
      .set('Authorization', `Bearer ${driverToken}`);

    expect(collRes.statusCode).toEqual(200);
    expect(collRes.body.data.totalCollectedAmount).toEqual(150000);
    expect(collRes.body.data.collections.length).toBeGreaterThanOrEqual(1);
  });
});


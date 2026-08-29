import request from 'supertest';
import mongoose from 'mongoose';
import { createServer } from 'http';
import { io as Client } from 'socket.io-client';
import app from '../src/app.js';
import { connectDB } from '../src/config/db.js';
import { seedDatabase } from '../src/database/seed.js';
import { cleanDatabase } from './cleanup.js';
import { initSocket } from '../src/config/socket.js';
import Products from '../src/modules/products/products.model.js';
import { RareProductRequest, RareQuotation, RareChatMessage } from '../src/modules/rare-requests/rare-requests.model.js';

describe('Rare Product Request Workflow Integration Tests', () => {
  let ownerToken;
  let customerToken;
  let customerId;
  let requestId;
  let quotationId;
  let addressId;
  
  let httpServer;
  let socketClient;
  let adminSocketClient;
  let port;

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
      name: 'Customer Rare',
      email: 'customer.rare@test.com',
      phone: '+919876543299',
      password: 'P@ssword123!',
    });
    const logRes = await request(app).post('/api/v1/auth/customer/login').send({
      email: 'customer.rare@test.com',
      password: 'P@ssword123!',
    });
    customerToken = logRes.body.data.accessToken;
    customerId = logRes.body.data.user._id;

    // Create a customer address snapshot
    const addr = await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        name: 'Home',
        recipientName: 'Customer Rare',
        phone: '+919876543299',
        addressLine1: 'Volt Spares Street 10',
        city: 'Bangalore',
        state: 'Karnataka',
        postalCode: '560001',
      });
    addressId = addr.body.data._id;

    // 3. Initialize Live HTTP Server and Socket.io for Real-Time Event Tests
    httpServer = createServer(app);
    initSocket(httpServer);

    await new Promise((resolve) => {
      httpServer.listen(0, () => {
        port = httpServer.address().port;
        resolve();
      });
    });

    // 4. Connect Socket Client for Customer
    socketClient = Client(`http://localhost:${port}`, {
      auth: {
        token: customerToken,
      },
    });

    await new Promise((resolve, reject) => {
      socketClient.on('connect', resolve);
      socketClient.on('connect_error', reject);
    });

    // 5. Connect Socket Client for Admin
    adminSocketClient = Client(`http://localhost:${port}`, {
      auth: {
        token: ownerToken,
      },
    });

    await new Promise((resolve, reject) => {
      adminSocketClient.on('connect', resolve);
      adminSocketClient.on('connect_error', reject);
    });
  });

  afterAll(async () => {
    if (socketClient) {
      socketClient.disconnect();
    }
    if (adminSocketClient) {
      adminSocketClient.disconnect();
    }
    await new Promise((resolve) => httpServer.close(resolve));
    await mongoose.connection.close();
  });

  describe('Rare Product Request CRUD (REST)', () => {
    it('should submit a new request as customer', async () => {
      const res = await request(app)
        .post('/api/v1/rare-requests')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          title: 'Activa 6G Custom LED Headlight',
          description: 'A customized LED headlight assembly for Honda Activa 6G.',
          vehicleType: 'Petrol',
          vehicleBrand: 'Honda',
          vehicleModel: 'Honda Activa 6G',
          vehicleYear: 2021,
          partNumber: 'ACT-LED-HD-99',
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body.data.status).toEqual('submitted');
      expect(res.body.data.title).toEqual('Activa 6G Custom LED Headlight');
      requestId = res.body.data._id;
    });

    it('should fetch customer requests list', async () => {
      const res = await request(app)
        .get('/api/v1/rare-requests/my')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.length).toEqual(1);
    });

    it('should upload request images (Multer/Storage Fallback)', async () => {
      const res = await request(app)
        .post(`/api/v1/rare-requests/${requestId}/images`)
        .set('Authorization', `Bearer ${customerToken}`)
        .attach('images', Buffer.from('fake-image-binary-data'), 'headlight.jpg');

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.images.length).toEqual(1);
      expect(res.body.data.images[0].url).toContain('/uploads/images-');
    });
  });

  describe('Socket.IO Chat Real-Time & Security Constraints', () => {
    it('should join the request conversation room successfully', async () => {
      const joinPromise = new Promise((resolve) => {
        socketClient.emit('join_request', { requestId }, (response) => {
          resolve(response);
        });
      });

      const response = await joinPromise;
      expect(response.success).toBe(true);

      // Join admin client to room too
      await new Promise((resolve) => {
        adminSocketClient.emit('join_request', { requestId }, resolve);
      });
    });

    it('should enforce typing indicators', async () => {
      const typingPromise = new Promise((resolve) => {
        adminSocketClient.on('rare_chat:typing', (data) => {
          resolve(data);
        });
      });

      // Send typing event from customer client
      socketClient.emit('rare_chat:typing', { requestId, isTyping: true });

      const typingData = await typingPromise;
      expect(typingData.requestId).toEqual(requestId.toString());
      expect(typingData.isTyping).toBe(true);
    });

    it('should persist chat message and broadcast to room', async () => {
      const msgPromise = new Promise((resolve) => {
        adminSocketClient.on('rare_chat:message', (data) => {
          resolve(data);
        });
      });

      socketClient.emit('rare_chat:message', {
        requestId,
        message: 'Hello admin, any updates on this headlight?',
      });

      const msg = await msgPromise;
      expect(msg.message).toEqual('Hello admin, any updates on this headlight?');
      expect(msg.sender._id).toEqual(customerId.toString());
      expect(msg.senderType).toEqual('customer');

      // Verify stored in MongoDB
      const dbMsg = await RareChatMessage.findOne({ request: requestId, messageType: 'text' });
      expect(dbMsg).toBeDefined();
      expect(dbMsg.message).toEqual('Hello admin, any updates on this headlight?');
    });

    it('should sanitize chat message text and block HTML injection', async () => {
      const msgPromise = new Promise((resolve) => {
        adminSocketClient.once('rare_chat:message', (data) => {
          resolve(data);
        });
      });

      socketClient.emit('rare_chat:message', {
        requestId,
        message: '<script>alert("hack")</script>Hello!',
      });

      const msg = await msgPromise;
      expect(msg.message).not.toContain('<script>');
      expect(msg.message).toContain('&lt;script&gt;');
    });

    it('should enforce rate limits on socket messages', async () => {
      const results = [];
      for (let i = 0; i < 7; i++) {
        results.push(
          new Promise((resolve) => {
            socketClient.emit('rare_chat:message', { requestId, message: `Msg ${i}` }, (response) => {
              resolve(response);
            });
          })
        );
      }

      const responses = await Promise.all(results);
      const failures = responses.filter((r) => r && r.success === false);
      expect(failures.length).toBeGreaterThan(0);
      expect(failures[0].message).toContain('Rate limit exceeded');
    });
  });

  describe('Admin Quotations Revision & Expiry Checks', () => {
    it('should allow admin to create a quotation draft in paise', async () => {
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + 5);

      const res = await request(app)
        .post(`/api/v1/admin/rare-requests/${requestId}/quotations`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          expiresAt: expiry.toISOString(),
          deliveryFee: 15000, // ₹150.00
          items: [
            {
              name: 'Custom LED Headlight Unit',
              partNumber: 'ACT-LED-HD-99',
              quantity: 1,
              unitPrice: 200000, // ₹2000.00
            },
          ],
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body.data.status).toEqual('draft');
      expect(res.body.data.grandTotal).toEqual(251000); // 200000 + 36000 (tax) + 15000 (delivery) = 251000 paise (₹2510.00)
      quotationId = res.body.data._id;
    });

    it('should allow admin to revise a draft quotation and increment revisionNumber', async () => {
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + 5);

      const res = await request(app)
        .patch(`/api/v1/admin/rare-requests/${requestId}/quotations/${quotationId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          expiresAt: expiry.toISOString(),
          deliveryFee: 10000, // revised to ₹100.00 (10000 paise)
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.grandTotal).toEqual(246000); // revised grandTotal
      expect(res.body.data.revisionNumber).toEqual(1);
      expect(res.body.data.revisedFrom).toEqual(quotationId.toString());

      // Update active quotation ID to revised one
      quotationId = res.body.data._id;
    });

    it('should allow admin to send quotation to customer', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/rare-requests/${requestId}/quotations/${quotationId}/send`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.status).toEqual('sent');

      const reqDoc = await RareProductRequest.findById(requestId);
      expect(reqDoc.status).toEqual('quotation_sent');
    });
  });

  describe('Customer Approval & Cancel blocked states', () => {
    it('should allow customer to approve quotation', async () => {
      const res = await request(app)
        .patch(`/api/v1/rare-requests/${requestId}/quotations/${quotationId}/approve`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.quotation.status).toEqual('approved');
      expect(res.body.data.request.status).toEqual('approved');
    });

    it('should block customer from approving a cancelled or expired quotation', async () => {
      // Create a draft, cancel it, then try to approve
      const cp = await RareQuotation.create({
        request: requestId,
        quotationNumber: 'QTN-DUMMY',
        items: [],
        subTotal: 0,
        taxAmount: 0,
        deliveryFee: 0,
        grandTotal: 0,
        status: 'cancelled',
        expiresAt: new Date(),
        createdBy: customerId,
      });

      const res = await request(app)
        .patch(`/api/v1/rare-requests/${requestId}/quotations/${cp._id}/approve`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.statusCode).toEqual(400);
    });
  });

  describe('Order Conversion transaction details', () => {
    it('should convert approved rare request to order dynamically, deducting stock levels', async () => {
      const prdBefore = await Products.findOne({ name: 'Custom LED Headlight Unit' });
      expect(prdBefore).toBeNull();

      const res = await request(app)
        .post(`/api/v1/admin/rare-requests/${requestId}/convert-to-order`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          addressId,
        });

      if (res.statusCode !== 201) {
        console.log('CONVERT ERROR BODY:', res.body);
      }
      expect(res.statusCode).toEqual(201);
      expect(res.body.data.grandTotal).toEqual(2460); // 246000 paise to ₹2460.00
      expect(res.body.data.status).toEqual('confirmed');

      // Verify product dynamic registration and stock updates
      const product = await Products.findOne({ name: 'Custom LED Headlight Unit' });
      expect(product).toBeDefined();
      expect(product.currentStock).toEqual(0); // opening stock matched quantity (1) and deducted to 0!

      // Verify request status converted
      const reqDoc = await RareProductRequest.findById(requestId);
      expect(reqDoc.status).toEqual('converted_to_order');
      expect(reqDoc.convertedOrder.toString()).toEqual(res.body.data._id.toString());
    });
  });
});

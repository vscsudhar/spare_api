import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app.js';
import { connectDB } from '../src/config/db.js';
import { seedDatabase } from '../src/database/seed.js';
import Users from '../src/modules/users/users.model.js';
import Role from '../src/modules/users/roles.model.js';
import RefreshToken from '../src/modules/auth/refresh-token.model.js';

describe('Auth & RBAC Integration Tests', () => {
  let salesStaffRole;
  let testCustomerToken;
  let testAdminToken;
  let testOwnerToken;

  let staffId;

  // Seeding credentials
  const customerEmail = 'customer@test.com';
  const customerPhone = '+1111111111';
  const customerPass = 'CustomerPass123!';

  const staffEmail = 'staff@test.com';
  const staffPhone = '+2222222222';
  const staffPass = 'StaffPass123!';

  beforeAll(async () => {
    // Connect and seed database
    await connectDB();
    await seedDatabase(false);

    // Fetch seeded roles
    salesStaffRole = await Role.findOne({ name: 'sales_staff' });

    // Clean up any test users that might exist
    await Users.deleteMany({ email: { $in: [customerEmail, staffEmail, 'dup@test.com'] } });
    await RefreshToken.deleteMany({});
  });

  afterAll(async () => {
    // Cleanup databases
    await Users.deleteMany({ email: { $in: [customerEmail, staffEmail, 'dup@test.com'] } });
    await RefreshToken.deleteMany({});
    await mongoose.connection.close();
  });

  describe('POST /api/v1/auth/customer/register', () => {
    it('should register a customer with valid data', async () => {
      const res = await request(app).post('/api/v1/auth/customer/register').send({
        name: 'Test Customer',
        email: customerEmail,
        phone: customerPhone,
        password: customerPass,
      });

      expect(res.statusCode).toEqual(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data).toHaveProperty('refreshToken');
      expect(res.body.data.user.email).toEqual(customerEmail);

      testCustomerToken = res.body.data.accessToken;
    });

    it('should return 400 for duplicate email', async () => {
      const res = await request(app).post('/api/v1/auth/customer/register').send({
        name: 'Another User',
        email: customerEmail, // duplicate
        phone: '+999999999',
        password: 'Password123!',
      });

      expect(res.statusCode).toEqual(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('already registered');
    });

    it('should return 400 for weak password', async () => {
      const res = await request(app).post('/api/v1/auth/customer/register').send({
        name: 'Another User',
        email: 'dup@test.com',
        phone: '+999999999',
        password: '123', // weak
      });

      expect(res.statusCode).toEqual(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors[0].message).toContain('at least 8 characters');
    });
  });

  describe('POST /api/v1/auth/customer/login', () => {
    it('should log in customer with correct credentials', async () => {
      const res = await request(app).post('/api/v1/auth/customer/login').send({
        email: customerEmail,
        password: customerPass,
      });

      expect(res.statusCode).toEqual(200);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data.user.email).toEqual(customerEmail);
    });

    it('should reject customer login with incorrect password', async () => {
      const res = await request(app).post('/api/v1/auth/customer/login').send({
        email: customerEmail,
        password: 'WrongPassword!',
      });

      expect(res.statusCode).toEqual(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject staff login on customer route', async () => {
      // Owner is seeded, let's login owner (staff) on customer endpoint
      const res = await request(app).post('/api/v1/auth/customer/login').send({
        email: process.env.OWNER_EMAIL,
        password: process.env.OWNER_PASSWORD,
      });

      expect(res.statusCode).toEqual(403);
      expect(res.body.message).toContain('staff portal');
    });
  });

  describe('POST /api/v1/auth/admin/login', () => {
    it('should log in owner as staff', async () => {
      const res = await request(app).post('/api/v1/auth/admin/login').send({
        email: process.env.OWNER_EMAIL,
        password: process.env.OWNER_PASSWORD,
      });

      expect(res.statusCode).toEqual(200);
      testOwnerToken = res.body.data.accessToken;
    });

    it('should reject customer log in on admin endpoint', async () => {
      const res = await request(app).post('/api/v1/auth/admin/login').send({
        email: customerEmail,
        password: customerPass,
      });

      expect(res.statusCode).toEqual(403);
      expect(res.body.message).toContain('not authorized');
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('should fetch own user profile', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${testCustomerToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.user.email).toEqual(customerEmail);
      expect(res.body.data.user).not.toHaveProperty('passwordHash');
    });

    it('should reject request without token', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.statusCode).toEqual(401);
    });
  });

  describe('OTP Endpoints (Mock)', () => {
    it('should generate and send OTP', async () => {
      const res = await request(app).post('/api/v1/auth/send-otp').send({
        email: customerEmail,
      });

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.otp).toEqual('123456');
    });

    it('should verify OTP and mark user as verified', async () => {
      const res = await request(app).post('/api/v1/auth/verify-otp').send({
        identifier: customerEmail,
        otp: '123456',
      });

      expect(res.statusCode).toEqual(200);

      const user = await Users.findOne({ email: customerEmail });
      expect(user.emailVerified).toBe(true);
    });
  });

  describe('Access Control & Permissions', () => {
    it('should forbid customer from accessing staff list', async () => {
      const res = await request(app)
        .get('/api/v1/staff')
        .set('Authorization', `Bearer ${testCustomerToken}`);

      expect(res.statusCode).toEqual(403);
      expect(res.body.message).toContain('permission');
    });

    it('should allow owner to access staff list (bypass checks)', async () => {
      const res = await request(app)
        .get('/api/v1/staff')
        .set('Authorization', `Bearer ${testOwnerToken}`);

      expect(res.statusCode).toEqual(200);
    });
  });

  describe('Staff CRUD Management (by Owner)', () => {
    it('should create a staff member', async () => {
      const res = await request(app)
        .post('/api/v1/staff')
        .set('Authorization', `Bearer ${testOwnerToken}`)
        .send({
          name: 'Sales Staff',
          email: staffEmail,
          phone: staffPhone,
          password: staffPass,
          role: salesStaffRole._id,
          status: 'active',
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body.data.email).toEqual(staffEmail);
      staffId = res.body.data._id;
    });

    it('should login as the new staff', async () => {
      const res = await request(app).post('/api/v1/auth/admin/login').send({
        email: staffEmail,
        password: staffPass,
      });

      testAdminToken = res.body.data.accessToken;
    });

    it('should fail to read roles as the new sales staff (no staff.manage permission)', async () => {
      const res = await request(app)
        .get('/api/v1/roles')
        .set('Authorization', `Bearer ${testAdminToken}`);

      expect(res.statusCode).toEqual(403);
    });

    it('should update staff details', async () => {
      const res = await request(app)
        .patch(`/api/v1/staff/${staffId}`)
        .set('Authorization', `Bearer ${testOwnerToken}`)
        .send({
          name: 'Updated Sales Staff Name',
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.name).toEqual('Updated Sales Staff Name');
    });

    it('should disable a staff member', async () => {
      const res = await request(app)
        .patch(`/api/v1/staff/${staffId}/status`)
        .set('Authorization', `Bearer ${testOwnerToken}`)
        .send({
          status: 'disabled',
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.status).toEqual('disabled');
    });

    it('should reject login for disabled staff', async () => {
      const res = await request(app).post('/api/v1/auth/admin/login').send({
        email: staffEmail,
        password: staffPass,
      });

      expect(res.statusCode).toEqual(403);
      expect(res.body.message).toContain('deactivated or suspended');
    });

    it('should re-enable staff and check soft-delete works', async () => {
      // Re-enable
      await request(app)
        .patch(`/api/v1/staff/${staffId}/status`)
        .set('Authorization', `Bearer ${testOwnerToken}`)
        .send({ status: 'active' });

      // Delete (soft-delete)
      const delRes = await request(app)
        .delete(`/api/v1/staff/${staffId}`)
        .set('Authorization', `Bearer ${testOwnerToken}`);

      expect(delRes.statusCode).toEqual(200);

      // Verify soft delete hides from list
      const listRes = await request(app)
        .get('/api/v1/staff')
        .set('Authorization', `Bearer ${testOwnerToken}`);

      const inList = listRes.body.data.some((u) => u._id === staffId);
      expect(inList).toBe(false);
    });
  });

  describe('Refresh Token Rotation and Reuse Detection', () => {
    let baseRefreshToken;

    beforeAll(async () => {
      // Re-register customer to get fresh tokens
      await Users.deleteMany({ email: customerEmail });
      const reg = await request(app).post('/api/v1/auth/customer/register').send({
        name: 'RTR User',
        email: customerEmail,
        phone: customerPhone,
        password: customerPass,
      });
      baseRefreshToken = reg.body.data.refreshToken;
    });

    it('should rotate refresh token', async () => {
      const res = await request(app).post('/api/v1/auth/refresh-token').send({
        refreshToken: baseRefreshToken,
      });

      expect(res.statusCode).toEqual(200);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data).toHaveProperty('refreshToken');

      const rotatedToken = res.body.data.refreshToken;

      // Verify old token is marked revoked in DB
      const oldDbToken = await RefreshToken.findOne({ token: baseRefreshToken });
      expect(oldDbToken.isRevoked).toBe(true);
      expect(oldDbToken.replacedByToken).toEqual(rotatedToken);
    });

    it('should detect token reuse and invalidate all sessions', async () => {
      // Reuse the baseRefreshToken (which is already rotated)
      const res = await request(app).post('/api/v1/auth/refresh-token').send({
        refreshToken: baseRefreshToken, // Reuse!
      });

      expect(res.statusCode).toEqual(401);
      expect(res.body.message).toContain('revoked');

      // Verify that all refresh tokens for this user are now revoked
      const user = await Users.findOne({ email: customerEmail });
      const activeTokensCount = await RefreshToken.countDocuments({ user: user._id, isRevoked: false });
      expect(activeTokensCount).toEqual(0);
    });
  });
});

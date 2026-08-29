import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app.js';

describe('API Foundation Tests', () => {
  afterAll(async () => {
    // Ensure all mongoose connections are closed
    await mongoose.connection.close();
  });

  describe('GET /api/v1/health', () => {
    it('should return 200 and healthy status', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('status', 'UP');
    });
  });

  describe('GET /api/v1/health/database', () => {
    it('should return db connection status (either active or degrading)', async () => {
      const res = await request(app).get('/api/v1/health/database');
      expect([200, 503]).toContain(res.statusCode);
      if (res.statusCode === 200) {
        expect(res.body).toHaveProperty('success', true);
        expect(res.body.data).toHaveProperty('status', 'CONNECTED');
      } else {
        expect(res.body).toHaveProperty('success', false);
        expect(res.body).toHaveProperty('errors');
      }
    });
  });

  describe('GET /api/v1/non-existent-route', () => {
    it('should return 404 JSON for invalid routes', async () => {
      const res = await request(app).get('/api/v1/non-existent-route');
      expect(res.statusCode).toEqual(404);
      expect(res.body).toHaveProperty('success', false);
      expect(res.body).toHaveProperty('message');
      expect(res.body.message).toContain('Route not found');
    });
  });
});

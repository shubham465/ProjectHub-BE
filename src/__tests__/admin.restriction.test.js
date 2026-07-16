'use strict';

/**
 * Admin Modification Restriction Tests — HTTP seam (Supertest)
 *
 * Ticket 06: Admins cannot edit other Admin users.
 *
 * Seams under test (pre-agreed per TDD skill):
 *   1. PUT /api/users/:id — blocked when target is an Admin (other than self)
 *   2. PUT /api/users/:id — allowed when target is a Member
 */

jest.mock('ioredis', () => require('ioredis-mock'));

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const app = require('../app');
const User = require('../models/User');
const { connectRedis } = require('../config/redis');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  process.env.JWT_SECRET = 'test_jwt_secret_for_jest';
  process.env.NODE_ENV = 'test';
  connectRedis();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
});

const createUserAndLogin = async ({ role = 'Admin', email = 'alice@example.com', name = 'Alice', ...rest } = {}) => {
  await User.create({ name, email, password: 'password123', role, ...rest });
  const res = await request(app).post('/api/auth/login').send({ email, password: 'password123' });
  return { user: res.body.user, cookies: res.headers['set-cookie'] };
};

// ─── Admin modification restriction ──────────────────────────────────────────

describe('PUT /api/users/:id — Admin modification restriction', () => {
  it('returns 403 when an Admin attempts to edit another Admin user', async () => {
    const { cookies } = await createUserAndLogin({ email: 'admin1@test.com', name: 'Admin One' });
    const targetAdmin = await User.create({
      name: 'Admin Two',
      email: 'admin2@test.com',
      password: 'password123',
      role: 'Admin',
    });

    const res = await request(app)
      .put(`/api/users/${targetAdmin._id}`)
      .set('Cookie', cookies)
      .send({ name: 'Hacked Name' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/admin/i);
  });

  it('returns 200 when an Admin edits a Member user', async () => {
    const { cookies } = await createUserAndLogin({ email: 'admin@test.com', name: 'Admin One' });
    const member = await User.create({
      name: 'Member One',
      email: 'member@test.com',
      password: 'password123',
      role: 'Member',
    });

    const res = await request(app)
      .put(`/api/users/${member._id}`)
      .set('Cookie', cookies)
      .send({ name: 'Updated Member' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.name).toBe('Updated Member');
  });
});

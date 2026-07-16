'use strict';

/**
 * Auth API Tests — HTTP seam (Supertest)
 *
 * Tests drive the public HTTP interface only. No internals are probed.
 * DB: mongodb-memory-server (real Mongoose, in-memory)
 * Redis: ioredis-mock (automatic via jest.mock)
 *
 * Seams under test (pre-agreed per TDD skill):
 *   1. POST /api/auth/login
 *   2. GET  /api/auth/me
 *   3. POST /api/auth/logout
 */

// ─── Mock ioredis before any app import ──────────────────────────────────────
jest.mock('ioredis', () => require('ioredis-mock'));

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Must be required AFTER jest.mock('ioredis') so the app picks up the mock
const app = require('../app');
const User = require('../models/User');
const { connectRedis } = require('../config/redis');

// ─── Test Setup / Teardown ───────────────────────────────────────────────────

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  // Initialise the (mocked) Redis client so authenticate middleware can call getRedisClient()
  process.env.JWT_SECRET = 'test_jwt_secret_for_jest';
  process.env.NODE_ENV = 'test';
  connectRedis();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  // Clean DB between tests for isolation
  await User.deleteMany({});
});

// ─── Seed Helper ─────────────────────────────────────────────────────────────

const SEED_USER = {
  name: 'Alice Admin',
  email: 'alice@example.com',
  password: 'password123',
  role: 'Admin',
};

const seedUser = async (overrides = {}) => {
  return User.create({ ...SEED_USER, ...overrides });
};

// ─── 1. POST /api/auth/login ─────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  it('returns 200 and sets an HttpOnly cookie on valid credentials', async () => {
    await seedUser();

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: SEED_USER.email, password: SEED_USER.password });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe(SEED_USER.email);
    // Password must never be returned
    expect(res.body.user.password).toBeUndefined();

    // Verify HttpOnly cookie is set
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    const tokenCookie = cookies.find((c) => c.startsWith('token='));
    expect(tokenCookie).toBeDefined();
    expect(tokenCookie).toMatch(/HttpOnly/i);
  });

  it('returns 401 on incorrect password', async () => {
    await seedUser();

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: SEED_USER.email, password: 'wrong_password' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBeDefined();
    // Must not leak "which field was wrong" — same message for missing user too
    expect(res.body.message).toMatch(/invalid credentials/i);
  });

  it('returns 401 when user does not exist', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'irrelevant' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/invalid credentials/i);
  });

  it('returns 400 when email or password is missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: SEED_USER.email }); // no password

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ─── 2. GET /api/auth/me ─────────────────────────────────────────────────────

describe('GET /api/auth/me', () => {
  it('returns 200 and user object when a valid JWT cookie is present', async () => {
    await seedUser();

    // First log in to get the cookie
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: SEED_USER.email, password: SEED_USER.password });

    const cookies = loginRes.headers['set-cookie'];

    const res = await request(app).get('/api/auth/me').set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe(SEED_USER.email);
    expect(res.body.user.password).toBeUndefined();
  });

  it('returns 401 when no cookie is sent', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 when an invalid/tampered JWT cookie is sent', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', 'token=this.is.not.a.valid.jwt');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

// ─── 3. POST /api/auth/logout ────────────────────────────────────────────────

describe('POST /api/auth/logout', () => {
  it('returns 200 and clears the token cookie', async () => {
    await seedUser();

    // Log in first
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: SEED_USER.email, password: SEED_USER.password });

    const cookies = loginRes.headers['set-cookie'];

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Cookie should be cleared (Max-Age=0 or Expires in the past)
    const setCookieHeader = res.headers['set-cookie'];
    expect(setCookieHeader).toBeDefined();
    const clearedCookie = setCookieHeader.find((c) => c.startsWith('token='));
    expect(clearedCookie).toBeDefined();
    // Express clearCookie sets Expires to epoch (Thu, 01 Jan 1970)
    expect(clearedCookie).toMatch(/Expires=Thu, 01 Jan 1970/i);
  });

  it('returns 401 when called without a token', async () => {
    const res = await request(app).post('/api/auth/logout');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

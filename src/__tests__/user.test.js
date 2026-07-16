'use strict';

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

const createUserAndLogin = async ({ role = 'Member', ...overrides } = {}) => {
  const defaults = {
    name: role === 'Admin' ? 'Alice Admin' : 'Bob Member',
    email: role === 'Admin' ? 'alice@example.com' : 'bob@example.com',
    password: 'password123',
    role,
  };
  const finalData = { ...defaults, ...overrides };
  await User.create(finalData);

  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: finalData.email, password: finalData.password });

  return { user: res.body.user, cookies: res.headers['set-cookie'] };
};

describe('Users API', () => {
  describe('GET /api/users', () => {
    it('returns 200 and lists all users for Admin', async () => {
      const { cookies } = await createUserAndLogin({ role: 'Admin', email: 'admin1@test.com' });
      await User.create({ name: 'User 2', email: 'user2@test.com', password: 'password123', role: 'Member' });

      const res = await request(app).get('/api/users').set('Cookie', cookies);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.users.length).toBe(2);
      expect(res.body.users[0].password).toBeUndefined(); // Should exclude passwords
    });

    it('returns 403 when a Member requests the user list', async () => {
      const { cookies } = await createUserAndLogin({ role: 'Member' });
      const res = await request(app).get('/api/users').set('Cookie', cookies);
      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/users', () => {
    it('returns 201 and creates a user for Admin', async () => {
      const { cookies } = await createUserAndLogin({ role: 'Admin' });

      const res = await request(app)
        .post('/api/users')
        .set('Cookie', cookies)
        .send({
          name: 'New Member',
          email: 'new@example.com',
          role: 'Member',
          password: 'secretpassword'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.user.name).toBe('New Member');
      expect(res.body.user.email).toBe('new@example.com');
      expect(res.body.user.password).toBeUndefined();

      // Verify user was inserted into DB
      const dbUser = await User.findOne({ email: 'new@example.com' });
      expect(dbUser).not.toBeNull();
      expect(dbUser.role).toBe('Member');
    });

    it('returns 403 when a Member tries to create a user', async () => {
      const { cookies } = await createUserAndLogin({ role: 'Member' });

      const res = await request(app)
        .post('/api/users')
        .set('Cookie', cookies)
        .send({
          name: 'Sneaky',
          email: 'sneaky@example.com',
          role: 'Admin',
          password: 'hack'
        });

      expect(res.status).toBe(403);
    });
  });

  describe('PUT /api/users/:id', () => {
    it('returns 200 and updates a user for Admin', async () => {
      const { cookies } = await createUserAndLogin({ role: 'Admin' });
      const targetUser = await User.create({ name: 'Target', email: 'target@test.com', password: 'password123', role: 'Member' });

      const res = await request(app)
        .put(`/api/users/${targetUser._id}`)
        .set('Cookie', cookies)
        .send({ name: 'Updated Target', role: 'Admin' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.name).toBe('Updated Target');
      expect(res.body.user.role).toBe('Admin');
    });

    it('returns 403 when a Member tries to update a user', async () => {
      const { cookies } = await createUserAndLogin({ role: 'Member' });
      const targetUser = await User.create({ name: 'Target', email: 'target@test.com', password: 'password123', role: 'Member' });

      const res = await request(app)
        .put(`/api/users/${targetUser._id}`)
        .set('Cookie', cookies)
        .send({ role: 'Admin' });

      expect(res.status).toBe(403);
    });
  });
});

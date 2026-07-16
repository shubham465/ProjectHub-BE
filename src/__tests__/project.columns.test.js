'use strict';

/**
 * Project Columns & Aggregation Tests — HTTP seam (Supertest)
 *
 * Ticket 02: Backend-Driven Project Columns & Aggregation
 *
 * Seams under test (pre-agreed per TDD skill):
 *   1. Project schema — columns field defaults to the 4 canonical statuses
 *   2. GET /api/projects — each project includes `columns` and `totalTasks`
 *   3. GET /api/projects/:id — project includes `columns` and `totalTasks`
 */

jest.mock('ioredis', () => require('ioredis-mock'));

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const app = require('../app');
const User = require('../models/User');
const Project = require('../models/Project');
const Task = require('../models/Task');
const { connectRedis } = require('../config/redis');

// ─── Setup / Teardown ────────────────────────────────────────────────────────

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
  await Project.deleteMany({});
  await Task.deleteMany({});
});

// ─── Auth Helper ──────────────────────────────────────────────────────────────

const createUserAndLogin = async ({ role = 'Admin', email = 'alice@example.com', ...rest } = {}) => {
  const user = await User.create({ name: 'Alice Admin', email, password: 'password123', role, ...rest });
  const res = await request(app).post('/api/auth/login').send({ email, password: 'password123' });
  return { user, cookies: res.headers['set-cookie'] };
};

// ─── 1. Project schema — columns default ─────────────────────────────────────

describe('Project schema — columns field', () => {
  it('includes columns defaulting to the 4 canonical statuses when a project is created', async () => {
    const { cookies } = await createUserAndLogin();

    const res = await request(app)
      .post('/api/projects')
      .set('Cookie', cookies)
      .send({ name: 'Column Test Project' });

    expect(res.status).toBe(201);
    expect(res.body.project.columns).toEqual(['Todo', 'In Progress', 'In Review', 'Done']);
  });
});

// ─── 2. GET /api/projects — columns & totalTasks ──────────────────────────────

describe('GET /api/projects — aggregated fields', () => {
  it('returns columns and totalTasks=0 for a project with no tasks', async () => {
    const { cookies } = await createUserAndLogin();

    await request(app).post('/api/projects').set('Cookie', cookies).send({ name: 'Empty Project' });

    const res = await request(app).get('/api/projects').set('Cookie', cookies);

    expect(res.status).toBe(200);
    const project = res.body.projects[0];
    expect(project.columns).toEqual(['Todo', 'In Progress', 'In Review', 'Done']);
    expect(project.totalTasks).toBe(0);
  });

  it('returns the correct totalTasks count when a project has tasks', async () => {
    const { user, cookies } = await createUserAndLogin();

    const createRes = await request(app)
      .post('/api/projects')
      .set('Cookie', cookies)
      .send({ name: 'Busy Project' });

    const projectId = createRes.body.project._id;

    // Create 3 tasks for this project
    await Task.create([
      { title: 'Task A', projectId, status: 'Todo' },
      { title: 'Task B', projectId, status: 'In Progress' },
      { title: 'Task C', projectId, status: 'Done' },
    ]);

    const res = await request(app).get('/api/projects').set('Cookie', cookies);

    expect(res.status).toBe(200);
    const project = res.body.projects.find(p => p._id === projectId);
    expect(project.totalTasks).toBe(3);
  });
});

// ─── 3. GET /api/projects/:id — columns & totalTasks ─────────────────────────

describe('GET /api/projects/:id — aggregated fields', () => {
  it('returns columns and totalTasks for a specific project', async () => {
    const { user, cookies } = await createUserAndLogin();

    const createRes = await request(app)
      .post('/api/projects')
      .set('Cookie', cookies)
      .send({ name: 'Detail Project' });

    const projectId = createRes.body.project._id;

    // Create 2 tasks
    await Task.create([
      { title: 'Task 1', projectId, status: 'In Review' },
      { title: 'Task 2', projectId, status: 'Done' },
    ]);

    const res = await request(app).get(`/api/projects/${projectId}`).set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.project.columns).toEqual(['Todo', 'In Progress', 'In Review', 'Done']);
    expect(res.body.project.totalTasks).toBe(2);
  });
});

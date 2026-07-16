'use strict';

/**
 * Projects API Tests — HTTP seam (Supertest)
 *
 * DB:    mongodb-memory-server
 * Redis: ioredis-mock
 *
 * Seams under test (pre-agreed):
 *   1. POST /api/projects   — Admin only create
 *   2. GET  /api/projects   — List for authenticated user
 *   3. GET  /api/projects/:id — Single project fetch
 */

jest.mock('ioredis', () => require('ioredis-mock'));

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const app = require('../app');
const User = require('../models/User');
const Project = require('../models/Project');
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
});

// ─── Auth Helpers ─────────────────────────────────────────────────────────────

/**
 * Create a user and return { user, cookies } — cookies can be passed
 * directly to Supertest via .set('Cookie', cookies).
 */
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

// ─── 1. POST /api/projects ────────────────────────────────────────────────────

describe('POST /api/projects', () => {
  it('returns 201 and the created project when an Admin provides valid data', async () => {
    const { cookies } = await createUserAndLogin({ role: 'Admin' });

    const res = await request(app)
      .post('/api/projects')
      .set('Cookie', cookies)
      .send({ name: 'Alpha Project', description: 'Our first project' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.project).toBeDefined();
    expect(res.body.project.name).toBe('Alpha Project');
    expect(res.body.project.description).toBe('Our first project');
    expect(res.body.project.ownerId).toBeDefined();
  });

  it('returns 403 when a Member attempts to create a project', async () => {
    const { cookies } = await createUserAndLogin({ role: 'Member' });

    const res = await request(app)
      .post('/api/projects')
      .set('Cookie', cookies)
      .send({ name: 'Sneaky Project' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when name is missing', async () => {
    const { cookies } = await createUserAndLogin({ role: 'Admin' });

    const res = await request(app)
      .post('/api/projects')
      .set('Cookie', cookies)
      .send({ description: 'No name provided' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await request(app)
      .post('/api/projects')
      .send({ name: 'Ghost Project' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

// ─── 2. GET /api/projects ─────────────────────────────────────────────────────

describe('GET /api/projects', () => {
  it('returns 200 and an array of projects for an authenticated user', async () => {
    const { user: adminUser, cookies: adminCookies } = await createUserAndLogin({ role: 'Admin' });

    // Create two projects as Admin
    await request(app)
      .post('/api/projects')
      .set('Cookie', adminCookies)
      .send({ name: 'Project One' });
    await request(app)
      .post('/api/projects')
      .set('Cookie', adminCookies)
      .send({ name: 'Project Two' });

    const res = await request(app).get('/api/projects').set('Cookie', adminCookies);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.projects)).toBe(true);
    expect(res.body.projects.length).toBe(2);
  });

  it('returns an empty array when no projects exist', async () => {
    const { cookies } = await createUserAndLogin({ role: 'Member' });

    const res = await request(app).get('/api/projects').set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.projects)).toBe(true);
    expect(res.body.projects.length).toBe(0);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await request(app).get('/api/projects');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns only owned or assigned projects for a Member', async () => {
    const { user: adminUser, cookies: adminCookies } = await createUserAndLogin({ role: 'Admin', email: 'admin2@example.com' });
    const { user: memberUser, cookies: memberCookies } = await createUserAndLogin({ role: 'Member', email: 'member2@example.com' });

    // Project 1: Admin owns, no members (should be hidden from member)
    await request(app)
      .post('/api/projects')
      .set('Cookie', adminCookies)
      .send({ name: 'Admin Only Project' });

    // Project 2: Admin owns, member is assigned
    const p2Res = await request(app)
      .post('/api/projects')
      .set('Cookie', adminCookies)
      .send({ name: 'Assigned Project' });
    
    // Assign member to project 2 directly in DB for test setup
    await Project.findByIdAndUpdate(p2Res.body.project._id, { $push: { members: memberUser._id } });

    // Project 3: Member owns (created manually in DB as Member cannot POST)
    await Project.create({ name: 'Owned Project', ownerId: memberUser._id });

    const res = await request(app).get('/api/projects').set('Cookie', memberCookies);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.projects.length).toBe(2);
    
    const projectNames = res.body.projects.map(p => p.name);
    expect(projectNames).toContain('Assigned Project');
    expect(projectNames).toContain('Owned Project');
    expect(projectNames).not.toContain('Admin Only Project');
  });
});

// ─── 3. GET /api/projects/:id ────────────────────────────────────────────────

describe('GET /api/projects/:id', () => {
  it('returns 200 and the project when a valid id is requested', async () => {
    const { cookies } = await createUserAndLogin({ role: 'Admin' });

    const createRes = await request(app)
      .post('/api/projects')
      .set('Cookie', cookies)
      .send({ name: 'Detail Project', description: 'A project to fetch by ID' });

    const projectId = createRes.body.project._id;

    const res = await request(app)
      .get(`/api/projects/${projectId}`)
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.project._id).toBe(projectId);
    expect(res.body.project.name).toBe('Detail Project');
  });

  it('returns 404 when the project id does not exist', async () => {
    const { cookies } = await createUserAndLogin({ role: 'Member' });
    const fakeId = new mongoose.Types.ObjectId().toString();

    const res = await request(app)
      .get(`/api/projects/${fakeId}`)
      .set('Cookie', cookies);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 when unauthenticated', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();

    const res = await request(app).get(`/api/projects/${fakeId}`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 403 when a Member accesses an unassigned project', async () => {
    const { user: adminUser, cookies: adminCookies } = await createUserAndLogin({ role: 'Admin', email: 'admin3@example.com' });
    const { cookies: memberCookies } = await createUserAndLogin({ role: 'Member', email: 'member3@example.com' });

    const createRes = await request(app)
      .post('/api/projects')
      .set('Cookie', adminCookies)
      .send({ name: 'Secret Project' });

    const projectId = createRes.body.project._id;

    const res = await request(app)
      .get(`/api/projects/${projectId}`)
      .set('Cookie', memberCookies);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });
});

// ─── 4. PUT /api/projects/:id ────────────────────────────────────────────────

describe('PUT /api/projects/:id', () => {
  it('returns 200 and updates the project when Admin provides valid data', async () => {
    const { cookies } = await createUserAndLogin({ role: 'Admin', email: 'adminput@example.com' });
    const { user: memberUser } = await createUserAndLogin({ role: 'Member', email: 'memberput@example.com' });

    const createRes = await request(app)
      .post('/api/projects')
      .set('Cookie', cookies)
      .send({ name: 'Old Name' });

    const projectId = createRes.body.project._id;

    const res = await request(app)
      .put(`/api/projects/${projectId}`)
      .set('Cookie', cookies)
      .send({ name: 'New Name', description: 'Updated', members: [memberUser._id] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.project.name).toBe('New Name');
    expect(res.body.project.description).toBe('Updated');
    expect(res.body.project.members[0]._id).toBe(memberUser._id);
  });

  it('returns 403 when a Member tries to update a project', async () => {
    const { cookies: adminCookies } = await createUserAndLogin({ role: 'Admin', email: 'adminput2@example.com' });
    const { cookies: memberCookies } = await createUserAndLogin({ role: 'Member', email: 'memberput2@example.com' });

    const createRes = await request(app)
      .post('/api/projects')
      .set('Cookie', adminCookies)
      .send({ name: 'Secret Project' });

    const projectId = createRes.body.project._id;

    const res = await request(app)
      .put(`/api/projects/${projectId}`)
      .set('Cookie', memberCookies)
      .send({ name: 'Hacked Name' });

    expect(res.status).toBe(403);
  });
});

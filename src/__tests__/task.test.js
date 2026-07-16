'use strict';

/**
 * Tasks API Tests — HTTP seam (Supertest)
 *
 * DB:    mongodb-memory-server
 * Redis: ioredis-mock
 *
 * Seams under test (pre-agreed):
 *   1. POST   /api/tasks              — Create task within a project
 *   2. PATCH  /api/tasks/:id          — Update status / priority / title
 *   3. DELETE /api/tasks/:id          — Delete task
 *   4. GET    /api/tasks?projectId=   — List tasks for a project
 *
 * Domain vocabulary (from CONTEXT.md):
 *   Status:   Todo | In Progress | In Review | Done
 *   Priority: Low | Medium | High
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

// ─── Auth + Fixture Helpers ───────────────────────────────────────────────────

const createUserAndLogin = async ({ role = 'Member', email, name } = {}) => {
  const defaults = {
    name: name || (role === 'Admin' ? 'Alice Admin' : 'Bob Member'),
    email: email || (role === 'Admin' ? 'alice@example.com' : 'bob@example.com'),
    password: 'password123',
    role,
  };
  await User.create(defaults);
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: defaults.email, password: defaults.password });
  return { user: res.body.user, cookies: res.headers['set-cookie'] };
};

/** Create a project via the API and return its _id. */
const createProject = async (adminCookies, name = 'Test Project') => {
  const res = await request(app)
    .post('/api/projects')
    .set('Cookie', adminCookies)
    .send({ name });
  return res.body.project._id;
};

// ─── 1. POST /api/tasks ───────────────────────────────────────────────────────

describe('POST /api/tasks', () => {
  it('returns 201 and the created task on valid data', async () => {
    const { cookies: adminCookies, user: admin } = await createUserAndLogin({ role: 'Admin' });
    const { cookies: memberCookies, user: member } = await createUserAndLogin({
      role: 'Member',
      email: 'bob@example.com',
      name: 'Bob Member',
    });
    const projectId = await createProject(adminCookies);

    const res = await request(app)
      .post('/api/tasks')
      .set('Cookie', memberCookies)
      .send({
        title: 'Build login page',
        description: 'Implement the login UI',
        priority: 'High',
        projectId,
        assigneeId: member._id,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.task).toBeDefined();
    expect(res.body.task.title).toBe('Build login page');
    expect(res.body.task.status).toBe('Todo'); // Default status
    expect(res.body.task.priority).toBe('High');
    expect(res.body.task.projectId).toBe(projectId);
  });

  it('returns 400 when title is missing', async () => {
    const { cookies } = await createUserAndLogin({ role: 'Admin' });
    const projectId = await createProject(cookies);

    const res = await request(app)
      .post('/api/tasks')
      .set('Cookie', cookies)
      .send({ projectId, priority: 'Low' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when projectId is missing', async () => {
    const { cookies } = await createUserAndLogin({ role: 'Member' });

    const res = await request(app)
      .post('/api/tasks')
      .set('Cookie', cookies)
      .send({ title: 'Orphan task' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when priority is an invalid enum value', async () => {
    const { cookies: adminCookies } = await createUserAndLogin({ role: 'Admin' });
    const projectId = await createProject(adminCookies);
    const { cookies } = await createUserAndLogin({
      role: 'Member',
      email: 'bob@example.com',
    });

    const res = await request(app)
      .post('/api/tasks')
      .set('Cookie', cookies)
      .send({ title: 'Bad task', projectId, priority: 'Critical' }); // Not a valid Priority

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 when the referenced project does not exist', async () => {
    const { cookies } = await createUserAndLogin({ role: 'Member' });
    const fakeProjectId = new mongoose.Types.ObjectId().toString();

    const res = await request(app)
      .post('/api/tasks')
      .set('Cookie', cookies)
      .send({ title: 'Ghost task', projectId: fakeProjectId });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({ title: 'No auth task' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

// ─── 2. PATCH /api/tasks/:id ─────────────────────────────────────────────────

describe('PATCH /api/tasks/:id', () => {
  /** Seed a task directly in the DB for PATCH/DELETE tests. */
  const seedTask = async (projectId, assigneeId) =>
    Task.create({
      title: 'Seed Task',
      description: '',
      status: 'Todo',
      priority: 'Low',
      projectId,
      assigneeId,
    });

  it('returns 200 and updates the status of a task', async () => {
    const { cookies, user } = await createUserAndLogin({ role: 'Admin' });
    const projectId = await createProject(cookies);
    const task = await seedTask(projectId, user._id);

    const res = await request(app)
      .patch(`/api/tasks/${task._id}`)
      .set('Cookie', cookies)
      .send({ status: 'In Progress' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.task.status).toBe('In Progress');
  });

  it('returns 200 and updates the priority of a task', async () => {
    const { cookies, user } = await createUserAndLogin({ role: 'Admin' });
    const projectId = await createProject(cookies);
    const task = await seedTask(projectId, user._id);

    const res = await request(app)
      .patch(`/api/tasks/${task._id}`)
      .set('Cookie', cookies)
      .send({ priority: 'High' });

    expect(res.status).toBe(200);
    expect(res.body.task.priority).toBe('High');
  });

  it('returns 200 and updates the assignee of a task, returning populated user', async () => {
    const { cookies, user } = await createUserAndLogin({ role: 'Admin' });
    const { user: newAssignee } = await createUserAndLogin({ role: 'Member', email: 'new@example.com' });
    const projectId = await createProject(cookies);
    const task = await seedTask(projectId, user._id);

    const res = await request(app)
      .patch(`/api/tasks/${task._id}`)
      .set('Cookie', cookies)
      .send({ assigneeId: newAssignee._id });

    expect(res.status).toBe(200);
    expect(res.body.task.assigneeId._id).toBe(newAssignee._id);
    expect(res.body.task.assigneeId.name).toBe(newAssignee.name);
  });

  it('returns 400 when an invalid status enum value is supplied', async () => {
    const { cookies, user } = await createUserAndLogin({ role: 'Admin' });
    const projectId = await createProject(cookies);
    const task = await seedTask(projectId, user._id);

    const res = await request(app)
      .patch(`/api/tasks/${task._id}`)
      .set('Cookie', cookies)
      .send({ status: 'Blocked' }); // Not a valid Status

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when an invalid priority enum value is supplied', async () => {
    const { cookies, user } = await createUserAndLogin({ role: 'Admin' });
    const projectId = await createProject(cookies);
    const task = await seedTask(projectId, user._id);

    const res = await request(app)
      .patch(`/api/tasks/${task._id}`)
      .set('Cookie', cookies)
      .send({ priority: 'Urgent' }); // Not a valid Priority

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 when the task does not exist', async () => {
    const { cookies } = await createUserAndLogin({ role: 'Member' });
    const fakeId = new mongoose.Types.ObjectId().toString();

    const res = await request(app)
      .patch(`/api/tasks/${fakeId}`)
      .set('Cookie', cookies)
      .send({ status: 'Done' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 when unauthenticated', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();

    const res = await request(app)
      .patch(`/api/tasks/${fakeId}`)
      .send({ status: 'Done' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

// ─── 3. DELETE /api/tasks/:id ────────────────────────────────────────────────

describe('DELETE /api/tasks/:id', () => {
  it('returns 200 and deletes the task', async () => {
    const { cookies, user } = await createUserAndLogin({ role: 'Admin' });
    const projectId = await createProject(cookies);
    const task = await Task.create({
      title: 'To be deleted',
      status: 'Todo',
      priority: 'Low',
      projectId,
      assigneeId: user._id,
    });

    const res = await request(app)
      .delete(`/api/tasks/${task._id}`)
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify the task is gone — use the model directly as the spec allows
    const deleted = await Task.findById(task._id);
    expect(deleted).toBeNull();
  });

  it('returns 404 when the task does not exist', async () => {
    const { cookies } = await createUserAndLogin({ role: 'Member' });
    const fakeId = new mongoose.Types.ObjectId().toString();

    const res = await request(app)
      .delete(`/api/tasks/${fakeId}`)
      .set('Cookie', cookies);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 when unauthenticated', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();

    const res = await request(app).delete(`/api/tasks/${fakeId}`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

// ─── 4. GET /api/tasks?projectId= ────────────────────────────────────────────

describe('GET /api/tasks', () => {
  it('returns 200 and an array of tasks for the given projectId', async () => {
    const { cookies, user } = await createUserAndLogin({ role: 'Admin' });
    const projectId = await createProject(cookies);

    // Seed two tasks directly for speed
    await Task.create([
      { title: 'Task A', status: 'Todo', priority: 'Low', projectId, assigneeId: user._id },
      { title: 'Task B', status: 'In Progress', priority: 'High', projectId, assigneeId: user._id },
    ]);

    const res = await request(app)
      .get('/api/tasks')
      .query({ projectId })
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.tasks)).toBe(true);
    expect(res.body.tasks.length).toBe(2);
    expect(res.body.tasks.every((t) => t.projectId === projectId)).toBe(true);
    // Ensure assigneeId is populated
    expect(res.body.tasks[0].assigneeId._id).toBe(user._id);
    expect(res.body.tasks[0].assigneeId.name).toBe(user.name);
  });

  it('returns an empty array when a project has no tasks', async () => {
    const { cookies } = await createUserAndLogin({ role: 'Admin' });
    const projectId = await createProject(cookies);

    const res = await request(app)
      .get('/api/tasks')
      .query({ projectId })
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.tasks.length).toBe(0);
  });

  it('returns 400 when projectId query param is missing', async () => {
    const { cookies } = await createUserAndLogin({ role: 'Member' });

    const res = await request(app)
      .get('/api/tasks')
      .set('Cookie', cookies);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await request(app).get('/api/tasks');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

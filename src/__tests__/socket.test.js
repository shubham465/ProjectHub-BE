'use strict';

/**
 * WebSocket Tests — Socket.IO seam (socket.io-client)
 *
 * Strategy (per PRD §Testing Decisions):
 *   Spin up a real http.Server with Socket.IO attached on a random port.
 *   Connect test clients, emit JOIN_PROJECT_ROOM, trigger HTTP mutations,
 *   and assert that TASK_UPDATED is broadcast to the correct room.
 *
 * Seams under test (pre-agreed):
 *   1. Socket auth  — valid cookie connects; missing cookie is rejected
 *   2. Room events  — JOIN_PROJECT_ROOM puts client in room; LEAVE removes it
 *   3. Broadcast    — PATCH /api/tasks/:id emits TASK_UPDATED to room members only
 */

jest.mock('ioredis', () => require('ioredis-mock'));

const http = require('http');
const { Server } = require('socket.io');
const { io: ioc } = require('socket.io-client');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const app = require('../app');
const { initSocket } = require('../socket');
const User = require('../models/User');
const Project = require('../models/Project');
const Task = require('../models/Task');
const { connectRedis } = require('../config/redis');

// ─── Setup / Teardown ────────────────────────────────────────────────────────

let mongoServer;
let httpServer;
let serverAddress;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  process.env.JWT_SECRET = 'test_jwt_secret_for_jest';
  process.env.NODE_ENV = 'test';
  connectRedis();

  // Attach Socket.IO to a real HTTP server bound on a random port
  httpServer = http.createServer(app);
  initSocket(httpServer);
  await new Promise((resolve) => httpServer.listen(0, resolve));
  const { port } = httpServer.address();
  serverAddress = `http://localhost:${port}`;
});

afterAll(async () => {
  await new Promise((resolve) => httpServer.close(resolve));
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await Project.deleteMany({});
  await Task.deleteMany({});
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Create user + return login cookie string */
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
  // Return the raw Set-Cookie string array (used for both Supertest and socket.io-client)
  return { cookies: res.headers['set-cookie'], user: res.body.user };
};

/** Extract the raw cookie header string for socket.io-client */
const cookieHeader = (cookies) => cookies.join('; ');

/** Connect a socket.io-client with optional cookie. Returns the client socket. */
const connectSocket = (cookie) => {
  return ioc(serverAddress, {
    extraHeaders: cookie ? { cookie } : {},
    transports: ['websocket'],
    reconnection: false,
  });
};

/** Wait for a socket event or time out */
const waitFor = (socket, event, timeoutMs = 2000) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for "${event}"`)), timeoutMs);
    socket.once(event, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });

/** Disconnect a socket and wait until it's closed */
const disconnectSocket = (socket) =>
  new Promise((resolve) => {
    if (!socket.connected) return resolve();
    socket.once('disconnect', resolve);
    socket.disconnect();
  });

// ─── 1. Socket Authentication ────────────────────────────────────────────────

describe('Socket.IO — Authentication', () => {
  it('connects successfully when a valid JWT cookie is provided', async () => {
    const { cookies } = await createUserAndLogin({ role: 'Member' });
    const socket = connectSocket(cookieHeader(cookies));

    await waitFor(socket, 'connect');

    expect(socket.connected).toBe(true);
    await disconnectSocket(socket);
  });

  it('rejects the connection when no cookie is provided', async () => {
    const socket = connectSocket(); // no cookie

    const error = await waitFor(socket, 'connect_error');

    expect(socket.connected).toBe(false);
    expect(error.message).toBeDefined();
    await disconnectSocket(socket);
  });
});

// ─── 2. Room Management ───────────────────────────────────────────────────────

describe('Socket.IO — Room Management', () => {
  it('receives TASK_UPDATED after joining a project room', async () => {
    const { cookies: adminCookies } = await createUserAndLogin({ role: 'Admin' });
    const { cookies: memberCookies, user: member } = await createUserAndLogin({
      role: 'Member',
      email: 'bob@example.com',
      name: 'Bob Member',
    });

    // Create project and seed task via HTTP
    const projectRes = await request(app)
      .post('/api/projects')
      .set('Cookie', adminCookies)
      .send({ name: 'Socket Test Project' });
    const projectId = projectRes.body.project._id;

    const taskRes = await request(app)
      .post('/api/tasks')
      .set('Cookie', memberCookies)
      .send({ title: 'Socket Task', projectId });
    const taskId = taskRes.body.task._id;

    // Connect client and join the project room
    const client = connectSocket(cookieHeader(memberCookies));
    await waitFor(client, 'connect');
    client.emit('JOIN_PROJECT_ROOM', { projectId });

    // Trigger the PATCH — should broadcast TASK_UPDATED
    const [taskUpdated] = await Promise.all([
      waitFor(client, 'TASK_UPDATED'),
      request(app)
        .patch(`/api/tasks/${taskId}`)
        .set('Cookie', memberCookies)
        .send({ status: 'In Progress' }),
    ]);

    expect(taskUpdated).toBeDefined();
    expect(taskUpdated.task).toBeDefined();
    expect(taskUpdated.task._id).toBe(taskId);
    expect(taskUpdated.task.status).toBe('In Progress');

    await disconnectSocket(client);
  });

  it('does NOT receive TASK_UPDATED after leaving the project room', async () => {
    const { cookies: adminCookies } = await createUserAndLogin({ role: 'Admin' });
    const { cookies: memberCookies } = await createUserAndLogin({
      role: 'Member',
      email: 'bob@example.com',
      name: 'Bob Member',
    });

    const projectRes = await request(app)
      .post('/api/projects')
      .set('Cookie', adminCookies)
      .send({ name: 'Leave Test Project' });
    const projectId = projectRes.body.project._id;

    const taskRes = await request(app)
      .post('/api/tasks')
      .set('Cookie', memberCookies)
      .send({ title: 'Leave Task', projectId });
    const taskId = taskRes.body.task._id;

    const client = connectSocket(cookieHeader(memberCookies));
    await waitFor(client, 'connect');

    // Join then immediately leave
    client.emit('JOIN_PROJECT_ROOM', { projectId });
    client.emit('LEAVE_PROJECT_ROOM', { projectId });

    // Small delay to let server process both events
    await new Promise((r) => setTimeout(r, 100));

    // Trigger PATCH — client should NOT receive TASK_UPDATED
    let received = false;
    client.once('TASK_UPDATED', () => { received = true; });

    await request(app)
      .patch(`/api/tasks/${taskId}`)
      .set('Cookie', memberCookies)
      .send({ status: 'Done' });

    // Wait a moment to confirm no event arrives
    await new Promise((r) => setTimeout(r, 300));
    expect(received).toBe(false);

    await disconnectSocket(client);
  });
});

// ─── 3. PATCH does NOT broadcast without a room subscriber ───────────────────

describe('Socket.IO — Broadcast isolation', () => {
  it('PATCH /api/tasks/:id still returns 200 even when no clients are in the room', async () => {
    const { cookies: adminCookies } = await createUserAndLogin({ role: 'Admin' });
    const { cookies: memberCookies } = await createUserAndLogin({
      role: 'Member',
      email: 'bob@example.com',
      name: 'Bob Member',
    });

    const projectRes = await request(app)
      .post('/api/projects')
      .set('Cookie', adminCookies)
      .send({ name: 'No-Subscriber Project' });
    const projectId = projectRes.body.project._id;

    const taskRes = await request(app)
      .post('/api/tasks')
      .set('Cookie', memberCookies)
      .send({ title: 'Isolated Task', projectId });
    const taskId = taskRes.body.task._id;

    // No socket client connected — broadcast should be a no-op, not a crash
    const res = await request(app)
      .patch(`/api/tasks/${taskId}`)
      .set('Cookie', memberCookies)
      .send({ status: 'In Review' });

    expect(res.status).toBe(200);
    expect(res.body.task.status).toBe('In Review');
  });
});

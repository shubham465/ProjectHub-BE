'use strict';

/**
 * TaskService Unit Tests — Service seam
 *
 * Seams under test (pre-agreed per TDD skill):
 *   1. TaskService.createTask(data)         — validates, creates, emits TASK_CREATED
 *   2. TaskService.updateTask(id, updates)  — validates enums, updates, emits TASK_UPDATED
 *   3. TaskService.deleteTask(id)           — deletes, emits TASK_DELETED
 *   4. TaskService.listTasksByProject(projectId) — returns tasks for a project
 *
 * The Task model, Project model, and getIO singleton are all mocked.
 * Tests verify behavior through the service's public interface only.
 */

// Mock models and socket singleton before requiring the service
jest.mock('../models/Task');
jest.mock('../models/Project');
jest.mock('../socket');

const mongoose = require('mongoose');
const Task = require('../models/Task');
const Project = require('../models/Project');
const { getIO } = require('../socket');
const TaskService = require('../services/task.service');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fakeProjectId = new mongoose.Types.ObjectId();
const fakeTaskId = new mongoose.Types.ObjectId();
const fakeUserId = new mongoose.Types.ObjectId();

/** A fake task document */
const makeTask = (overrides = {}) => ({
  _id: fakeTaskId,
  title: 'Test Task',
  description: '',
  status: 'Todo',
  priority: 'Medium',
  projectId: fakeProjectId,
  assigneeId: null,
  ...overrides,
});

/** A fake socket IO object — records which room and event were emitted */
const makeIO = () => {
  const emitMock = jest.fn();
  const toMock = jest.fn().mockReturnValue({ emit: emitMock });
  return { io: { to: toMock }, toMock, emitMock };
};

beforeEach(() => {
  jest.clearAllMocks();
  // Provide VALID_STATUSES and VALID_PRIORITIES as statics (mirrors real model)
  Task.VALID_STATUSES = ['Todo', 'In Progress', 'In Review', 'Done'];
  Task.VALID_PRIORITIES = ['Low', 'Medium', 'High'];
});

// ─── 1. createTask ────────────────────────────────────────────────────────────

describe('TaskService.createTask', () => {
  it('creates a task and emits TASK_CREATED to the project room', async () => {
    const task = makeTask({ title: 'New Task', priority: 'High' });
    Project.exists.mockResolvedValue(true);
    Task.create.mockResolvedValue(task);
    const { io, toMock, emitMock } = makeIO();
    getIO.mockReturnValue(io);

    const result = await TaskService.createTask({
      title: 'New Task',
      description: 'desc',
      priority: 'High',
      projectId: fakeProjectId.toString(),
      assigneeId: fakeUserId.toString(),
    });

    expect(Task.create).toHaveBeenCalledWith(expect.objectContaining({
      title: 'New Task',
      priority: 'High',
      projectId: fakeProjectId.toString(),
    }));
    expect(toMock).toHaveBeenCalledWith(`project:${fakeProjectId.toString()}`);
    expect(emitMock).toHaveBeenCalledWith('TASK_CREATED', { task });
    expect(result).toBe(task);
  });

  it('throws 400 when title is missing', async () => {
    await expect(
      TaskService.createTask({ projectId: fakeProjectId.toString() })
    ).rejects.toMatchObject({ statusCode: 400, message: 'Task title is required' });
    expect(Task.create).not.toHaveBeenCalled();
  });

  it('throws 400 when projectId is missing', async () => {
    await expect(
      TaskService.createTask({ title: 'Orphan' })
    ).rejects.toMatchObject({ statusCode: 400, message: 'projectId is required' });
    expect(Task.create).not.toHaveBeenCalled();
  });

  it('throws 400 when priority is an invalid enum value', async () => {
    await expect(
      TaskService.createTask({ title: 'Bad', projectId: fakeProjectId.toString(), priority: 'Critical' })
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(Task.create).not.toHaveBeenCalled();
  });

  it('throws 404 when the referenced project does not exist', async () => {
    Project.exists.mockResolvedValue(null);

    await expect(
      TaskService.createTask({ title: 'Ghost', projectId: fakeProjectId.toString() })
    ).rejects.toMatchObject({ statusCode: 404, message: 'Project not found' });
    expect(Task.create).not.toHaveBeenCalled();
  });
});

// ─── 2. updateTask ────────────────────────────────────────────────────────────

describe('TaskService.updateTask', () => {
  it('updates the task and emits TASK_UPDATED to the project room', async () => {
    const updatedTask = makeTask({ status: 'In Progress', projectId: fakeProjectId });
    Task.findByIdAndUpdate.mockResolvedValue(updatedTask);
    const { io, toMock, emitMock } = makeIO();
    getIO.mockReturnValue(io);

    const result = await TaskService.updateTask(fakeTaskId.toString(), { status: 'In Progress' });

    expect(Task.findByIdAndUpdate).toHaveBeenCalledWith(
      fakeTaskId.toString(),
      { status: 'In Progress' },
      { new: true, runValidators: true }
    );
    expect(toMock).toHaveBeenCalledWith(`project:${fakeProjectId.toString()}`);
    expect(emitMock).toHaveBeenCalledWith('TASK_UPDATED', { task: updatedTask });
    expect(result).toBe(updatedTask);
  });

  it('throws 400 when an invalid status is provided', async () => {
    await expect(
      TaskService.updateTask(fakeTaskId.toString(), { status: 'Blocked' })
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(Task.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('throws 400 when an invalid priority is provided', async () => {
    await expect(
      TaskService.updateTask(fakeTaskId.toString(), { priority: 'Urgent' })
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(Task.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('throws 404 when the task does not exist', async () => {
    Task.findByIdAndUpdate.mockResolvedValue(null);

    await expect(
      TaskService.updateTask(fakeTaskId.toString(), { status: 'Done' })
    ).rejects.toMatchObject({ statusCode: 404, message: 'Task not found' });
  });

  it('throws 404 on a CastError (invalid ObjectId)', async () => {
    const castError = new Error('Cast failed');
    castError.name = 'CastError';
    Task.findByIdAndUpdate.mockRejectedValue(castError);

    await expect(
      TaskService.updateTask('bad-id', { status: 'Done' })
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ─── 3. deleteTask ────────────────────────────────────────────────────────────

describe('TaskService.deleteTask', () => {
  it('deletes the task and emits TASK_DELETED to the project room', async () => {
    const task = makeTask({ projectId: fakeProjectId });
    Task.findByIdAndDelete.mockResolvedValue(task);
    const { io, toMock, emitMock } = makeIO();
    getIO.mockReturnValue(io);

    await TaskService.deleteTask(fakeTaskId.toString());

    expect(Task.findByIdAndDelete).toHaveBeenCalledWith(fakeTaskId.toString());
    expect(toMock).toHaveBeenCalledWith(`project:${fakeProjectId.toString()}`);
    expect(emitMock).toHaveBeenCalledWith('TASK_DELETED', { task });
  });

  it('throws 404 when the task does not exist', async () => {
    Task.findByIdAndDelete.mockResolvedValue(null);

    await expect(
      TaskService.deleteTask(fakeTaskId.toString())
    ).rejects.toMatchObject({ statusCode: 404, message: 'Task not found' });
  });

  it('throws 404 on a CastError (invalid ObjectId)', async () => {
    const castError = new Error('Cast failed');
    castError.name = 'CastError';
    Task.findByIdAndDelete.mockRejectedValue(castError);

    await expect(
      TaskService.deleteTask('bad-id')
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ─── 4. listTasksByProject ────────────────────────────────────────────────────

describe('TaskService.listTasksByProject', () => {
  it('returns all tasks for a given projectId', async () => {
    const tasks = [makeTask({ title: 'Task A' }), makeTask({ title: 'Task B' })];
    Task.find.mockResolvedValue(tasks);

    const result = await TaskService.listTasksByProject(fakeProjectId.toString());

    expect(Task.find).toHaveBeenCalledWith({ projectId: fakeProjectId.toString() });
    expect(result).toBe(tasks);
  });

  it('throws 400 when projectId is missing', async () => {
    await expect(
      TaskService.listTasksByProject(undefined)
    ).rejects.toMatchObject({ statusCode: 400, message: 'projectId query parameter is required' });
    expect(Task.find).not.toHaveBeenCalled();
  });
});

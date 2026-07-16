'use strict';

const Task = require('../models/Task');
const Project = require('../models/Project');
const { getIO } = require('../socket');
const { roomName } = require('../socket/handlers');

// ─── TaskService ──────────────────────────────────────────────────────────────

/**
 * Creates a new task within a project and broadcasts TASK_CREATED.
 *
 * @param {object} data
 * @param {string} data.title
 * @param {string} [data.description]
 * @param {string} [data.priority]
 * @param {string} data.projectId
 * @param {string} [data.assigneeId]
 * @returns {Promise<object>} The created task document.
 * @throws {Error} 400 for validation failures, 404 if project not found.
 */
const createTask = async ({ title, description, priority, projectId, assigneeId } = {}) => {
  if (!title || !title.trim()) {
    const err = new Error('Task title is required');
    err.statusCode = 400;
    throw err;
  }

  if (!projectId) {
    const err = new Error('projectId is required');
    err.statusCode = 400;
    throw err;
  }

  if (priority && !Task.VALID_PRIORITIES.includes(priority)) {
    const err = new Error(`Invalid priority. Must be one of: ${Task.VALID_PRIORITIES.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }

  const projectExists = await Project.exists({ _id: projectId });
  if (!projectExists) {
    const err = new Error('Project not found');
    err.statusCode = 404;
    throw err;
  }

  const task = await Task.create({
    title: title.trim(),
    description: description?.trim() ?? '',
    priority: priority || 'Medium',
    projectId,
    assigneeId: assigneeId || null,
  });

  const populatedTask = await task.populate('assigneeId', 'name email');

  // Broadcast — safe to ignore if Socket.IO is not initialised (e.g. test env)
  try {
    getIO().to(roomName(projectId.toString())).emit('TASK_CREATED', { task: populatedTask });
  } catch { /* Socket.IO not initialised */ }

  return populatedTask;
};

/**
 * Updates a task and broadcasts TASK_UPDATED.
 *
 * @param {string} id - Task ObjectId string.
 * @param {object} updates - Fields to update (status, priority, title, description, assigneeId).
 * @returns {Promise<object>} The updated task document.
 * @throws {Error} 400 for invalid enum values, 404 if task not found.
 */
const updateTask = async (id, updates = {}) => {
  const { status, priority, title, description, assigneeId } = updates;

  if (status !== undefined && !Task.VALID_STATUSES.includes(status)) {
    const err = new Error(`Invalid status. Must be one of: ${Task.VALID_STATUSES.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }

  if (priority !== undefined && !Task.VALID_PRIORITIES.includes(priority)) {
    const err = new Error(`Invalid priority. Must be one of: ${Task.VALID_PRIORITIES.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }

  // Build update payload from whichever fields were provided
  const patch = {};
  if (status !== undefined) patch.status = status;
  if (priority !== undefined) patch.priority = priority;
  if (title !== undefined) patch.title = title.trim();
  if (description !== undefined) patch.description = description.trim();
  if (assigneeId !== undefined) patch.assigneeId = assigneeId || null;

  try {
    const task = await Task.findByIdAndUpdate(id, patch, { new: true, runValidators: true }).populate('assigneeId', 'name email');

    if (!task) {
      const err = new Error('Task not found');
      err.statusCode = 404;
      throw err;
    }

    // Broadcast — safe to ignore if Socket.IO is not initialised (e.g. test env)
    try {
      getIO().to(roomName(task.projectId.toString())).emit('TASK_UPDATED', { task });
    } catch { /* Socket.IO not initialised */ }

    return task;
  } catch (err) {
    if (err.statusCode) throw err;
    if (err.name === 'CastError') {
      const notFound = new Error('Task not found');
      notFound.statusCode = 404;
      throw notFound;
    }
    throw err;
  }
};

/**
 * Deletes a task and broadcasts TASK_DELETED.
 *
 * @param {string} id - Task ObjectId string.
 * @returns {Promise<void>}
 * @throws {Error} 404 if task not found.
 */
const deleteTask = async (id) => {
  try {
    const task = await Task.findByIdAndDelete(id);

    if (!task) {
      const err = new Error('Task not found');
      err.statusCode = 404;
      throw err;
    }

    // Broadcast — safe to ignore if Socket.IO is not initialised (e.g. test env)
    try {
      getIO().to(roomName(task.projectId.toString())).emit('TASK_DELETED', { task });
    } catch { /* Socket.IO not initialised */ }
  } catch (err) {
    if (err.statusCode) throw err;
    if (err.name === 'CastError') {
      const notFound = new Error('Task not found');
      notFound.statusCode = 404;
      throw notFound;
    }
    throw err;
  }
};

/**
 * Returns all tasks for a given project.
 *
 * @param {string} projectId - The project's ObjectId string.
 * @returns {Promise<object[]>}
 * @throws {Error} 400 if projectId is missing.
 */
const listTasksByProject = async (projectId) => {
  if (!projectId) {
    const err = new Error('projectId query parameter is required');
    err.statusCode = 400;
    throw err;
  }

  return Task.find({ projectId }).populate('assigneeId', 'name email');
};

module.exports = { createTask, updateTask, deleteTask, listTasksByProject };

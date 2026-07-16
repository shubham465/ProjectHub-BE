'use strict';

const TaskService = require('../services/task.service');

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * POST /api/tasks
 * Any authenticated user can create a task within an existing project.
 * Required: { title, projectId }
 * Optional: { description, priority, assigneeId }
 */
const createTask = async (req, res, next) => {
  try {
    const task = await TaskService.createTask(req.body);
    res.status(201).json({ success: true, task });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/tasks/:id
 * Update a task's status, priority, title, or description.
 * Broadcasts TASK_UPDATED via Socket.IO (handled in TaskService).
 */
const updateTask = async (req, res, next) => {
  try {
    const task = await TaskService.updateTask(req.params.id, req.body);
    res.status(200).json({ success: true, task });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/tasks/:id
 * Deletes a task by ID.
 * Broadcasts TASK_DELETED via Socket.IO (handled in TaskService).
 */
const deleteTask = async (req, res, next) => {
  try {
    await TaskService.deleteTask(req.params.id);
    res.status(200).json({ success: true, message: 'Task deleted successfully' });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/tasks?projectId={id}
 * Returns all tasks for a given project.
 */
const listTasks = async (req, res, next) => {
  try {
    const tasks = await TaskService.listTasksByProject(req.query.projectId);
    res.status(200).json({ success: true, tasks });
  } catch (err) {
    next(err);
  }
};

module.exports = { createTask, updateTask, deleteTask, listTasks };

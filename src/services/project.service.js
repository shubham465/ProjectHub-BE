'use strict';

const Project = require('../models/Project');
const Task = require('../models/Task');

// ─── ProjectService ───────────────────────────────────────────────────────────

/**
 * Creates a new project.
 *
 * @param {string} name - Project name (will be trimmed).
 * @param {string|undefined} description - Optional description (will be trimmed).
 * @param {mongoose.Types.ObjectId} ownerId - ID of the owning user.
 * @returns {Promise<object>} The created project document.
 * @throws {Error} 400 if name is missing or blank.
 */
const createProject = async (name, description, ownerId) => {
  if (!name || !name.trim()) {
    const err = new Error('Project name is required');
    err.statusCode = 400;
    throw err;
  }

  return Project.create({
    name: name.trim(),
    description: description?.trim() ?? '',
    ownerId,
    members: [],
  });
};

/**
 * Returns projects sorted newest-first. Filters for members.
 * Each project includes a `totalTasks` count aggregated from the Task collection.
 *
 * @param {object} user - The requesting user object.
 * @returns {Promise<object[]>}
 */
const listProjects = async (user) => {
  let query = {};
  if (user && user.role === 'Member') {
    query = { $or: [{ ownerId: user._id }, { members: user._id }] };
  }

  const [projects, taskCounts] = await Promise.all([
    Project.find(query).sort({ createdAt: -1 }).populate('members', 'name email role'),
    Task.aggregate([
      { $group: { _id: '$projectId', count: { $sum: 1 } } },
    ]),
  ]);

  // Build a lookup map: projectId (string) → count
  const countMap = Object.fromEntries(
    taskCounts.map(({ _id, count }) => [_id.toString(), count])
  );

  return projects.map((project) => {
    const plain = project.toObject();
    plain.totalTasks = countMap[plain._id.toString()] ?? 0;
    return plain;
  });
};


/**
 * Returns a single project by its ID, validating access.
 *
 * @param {string} id - Mongoose ObjectId string.
 * @param {object} user - The requesting user object.
 * @returns {Promise<object>} The project document.
 * @throws {Error} 404 if no project exists, 403 if access denied.
 */
const getProject = async (id, user) => {
  try {
    const [project, totalTasks] = await Promise.all([
      Project.findById(id).populate('members', 'name email role'),
      Task.countDocuments({ projectId: id }),
    ]);

    if (!project) {
      const err = new Error('Project not found');
      err.statusCode = 404;
      throw err;
    }

    if (user && user.role === 'Member') {
      const isOwner = project.ownerId.toString() === user._id.toString();
      const isMember = project.members.some(m => m._id.toString() === user._id.toString());
      if (!isOwner && !isMember) {
        const err = new Error('Forbidden');
        err.statusCode = 403;
        throw err;
      }
    }

    const plain = project.toObject();
    plain.totalTasks = totalTasks;
    return plain;
  } catch (err) {
    if (err.statusCode === 404 || err.statusCode === 403) throw err;

    // Mongoose CastError (invalid ObjectId) → treat as 404
    if (err.name === 'CastError') {
      const notFound = new Error('Project not found');
      notFound.statusCode = 404;
      throw notFound;
    }

    throw err;
  }
};

/**
 * Updates a project.
 *
 * @param {string} id - Project ID
 * @param {object} updates - name, description, members array
 * @returns {Promise<object>} Updated project
 */
const updateProject = async (id, { name, description, members }) => {
  const project = await Project.findById(id);
  if (!project) {
    const err = new Error('Project not found');
    err.statusCode = 404;
    throw err;
  }

  if (name !== undefined) project.name = name.trim();
  if (description !== undefined) project.description = description.trim();
  if (members !== undefined) project.members = members;

  await project.save();
  return project.populate('members', 'name email role');
};

module.exports = { createProject, listProjects, getProject, updateProject };

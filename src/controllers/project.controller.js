'use strict';

const ProjectService = require('../services/project.service');


// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * POST /api/projects
 * Admin only. Creates a new project owned by the authenticated user.
 * Requires: { name } in req.body. description is optional.
 */
const createProject = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    const project = await ProjectService.createProject(name, description, req.user._id);
    res.status(201).json({ success: true, project });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/projects
 * Returns all projects. Any authenticated user can list projects.
 * (Per PRD: Members see all projects in the workspace. Per-member filtering
 * is a Phase 2 concern once membership/invitation is built.)
 */
const listProjects = async (req, res, next) => {
  try {
    const projects = await ProjectService.listProjects(req.user);
    res.status(200).json({ success: true, projects });
  } catch (err) {
    next(err);
  }
};

/**
 * Fetch a single project
 */
const getProject = async (req, res, next) => {
  try {
    const project = await ProjectService.getProject(req.params.id, req.user);
    res.status(200).json({ success: true, project });
  } catch (err) {
    next(err);
  }
};

/**
 * Update a project
 */
const updateProject = async (req, res, next) => {
  try {
    const project = await ProjectService.updateProject(req.params.id, req.body);
    res.status(200).json({ success: true, project });
  } catch (err) {
    next(err);
  }
};

module.exports = { createProject, listProjects, getProject, updateProject };

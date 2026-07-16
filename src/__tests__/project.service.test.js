'use strict';

/**
 * ProjectService Unit Tests — Service seam
 *
 * Seams under test (pre-agreed per TDD skill):
 *   1. ProjectService.createProject(name, description, ownerId)
 *   2. ProjectService.listProjects()
 *   3. ProjectService.getProject(id)
 *
 * The Mongoose Project model is mocked so tests run without a live DB.
 * Tests verify behavior through the service's public interface only.
 */

// Mock the Project model before requiring the service
jest.mock('../models/Project');

const mongoose = require('mongoose');
const Project = require('../models/Project');
const ProjectService = require('../services/project.service');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fakeOwnerId = new mongoose.Types.ObjectId();

const makeProject = (overrides = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  name: 'Test Project',
  description: 'A project',
  ownerId: fakeOwnerId,
  createdAt: new Date(),
  ...overrides,
});

// Reset mocks between tests to keep them isolated
beforeEach(() => {
  jest.clearAllMocks();
});

// ─── 1. createProject ────────────────────────────────────────────────────────

describe('ProjectService.createProject', () => {
  it('creates and returns a project with trimmed name and description', async () => {
    const project = makeProject({ name: 'Alpha Project', description: 'First' });
    Project.create.mockResolvedValue(project);

    const result = await ProjectService.createProject('  Alpha Project  ', 'First', fakeOwnerId);

    expect(Project.create).toHaveBeenCalledWith({
      name: 'Alpha Project',
      description: 'First',
      ownerId: fakeOwnerId,
    });
    expect(result).toBe(project);
  });

  it('uses empty string when description is not provided', async () => {
    const project = makeProject({ description: '' });
    Project.create.mockResolvedValue(project);

    await ProjectService.createProject('My Project', undefined, fakeOwnerId);

    expect(Project.create).toHaveBeenCalledWith({
      name: 'My Project',
      description: '',
      ownerId: fakeOwnerId,
    });
  });

  it('throws a 400 error when name is blank', async () => {
    await expect(
      ProjectService.createProject('   ', 'desc', fakeOwnerId)
    ).rejects.toMatchObject({ statusCode: 400, message: 'Project name is required' });

    expect(Project.create).not.toHaveBeenCalled();
  });

  it('throws a 400 error when name is missing', async () => {
    await expect(
      ProjectService.createProject(undefined, 'desc', fakeOwnerId)
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(Project.create).not.toHaveBeenCalled();
  });
});

// ─── 2. listProjects ──────────────────────────────────────────────────────────

describe('ProjectService.listProjects', () => {
  it('returns all projects sorted by createdAt descending', async () => {
    const projects = [makeProject({ name: 'B' }), makeProject({ name: 'A' })];
    const sortMock = jest.fn().mockResolvedValue(projects);
    Project.find.mockReturnValue({ sort: sortMock });

    const result = await ProjectService.listProjects();

    expect(Project.find).toHaveBeenCalledWith();
    expect(sortMock).toHaveBeenCalledWith({ createdAt: -1 });
    expect(result).toBe(projects);
  });
});

// ─── 3. getProject ───────────────────────────────────────────────────────────

describe('ProjectService.getProject', () => {
  it('returns the project when a valid id is found', async () => {
    const project = makeProject({ name: 'Found Project' });
    Project.findById.mockResolvedValue(project);

    const result = await ProjectService.getProject(project._id.toString());

    expect(Project.findById).toHaveBeenCalledWith(project._id.toString());
    expect(result).toBe(project);
  });

  it('throws a 404 error when the project does not exist', async () => {
    Project.findById.mockResolvedValue(null);

    await expect(
      ProjectService.getProject(new mongoose.Types.ObjectId().toString())
    ).rejects.toMatchObject({ statusCode: 404, message: 'Project not found' });
  });

  it('throws a 404 error on an invalid ObjectId (CastError)', async () => {
    const castError = new Error('Cast to ObjectId failed');
    castError.name = 'CastError';
    Project.findById.mockRejectedValue(castError);

    await expect(ProjectService.getProject('not-a-valid-id')).rejects.toMatchObject({
      statusCode: 404,
      message: 'Project not found',
    });
  });
});

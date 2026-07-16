const { Router } = require('express');
const authenticate = require('../middleware/authenticate');
const { createProject, listProjects, getProject, updateProject } = require('../controllers/project.controller');
const requireAdmin = require('../middleware/requireAdmin');

const router = Router();

// All project routes require authentication
router.use(authenticate);

router.post('/', requireAdmin, createProject);
router.get('/', listProjects);
router.get('/:id', getProject);
router.put('/:id', requireAdmin, updateProject);

module.exports = router;

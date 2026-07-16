const { Router } = require('express');
const authenticate = require('../middleware/authenticate');
const { createTask, updateTask, deleteTask, listTasks } = require('../controllers/task.controller');

const router = Router();

// All task routes require authentication
router.use(authenticate);

router.get('/', listTasks);
router.post('/', createTask);
router.patch('/:id', updateTask);
router.delete('/:id', deleteTask);

module.exports = router;

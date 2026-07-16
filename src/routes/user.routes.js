const { Router } = require('express');
const authenticate = require('../middleware/authenticate');
const requireAdmin = require('../middleware/requireAdmin');
const { listUsers, createUser, updateUser } = require('../controllers/user.controller');

const router = Router();

router.use(authenticate);
router.use(requireAdmin);

router.get('/', listUsers);
router.post('/', createUser);
router.put('/:id', updateUser);

module.exports = router;

const { Router } = require('express');
const authenticate = require('../middleware/authenticate');
const { login, me, logout } = require('../controllers/auth.controller');

const router = Router();

router.post('/login', login);
router.get('/me', authenticate, me);
router.post('/logout', authenticate, logout);

module.exports = router;

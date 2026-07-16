const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { getRedisClient } = require('../config/redis');

// ─── Helper ───────────────────────────────────────────────────────────────────

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Strict',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
};

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * POST /api/auth/login
 * Accepts { email, password } in req.body.
 * Returns 200 + sets HttpOnly JWT cookie on success.
 * Returns 400 on missing fields, 401 on bad credentials.
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      const err = new Error('Email and password are required');
      err.statusCode = 400;
      return next(err);
    }

    // password field is excluded by default via select:false on the schema
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      const err = new Error('Invalid credentials');
      err.statusCode = 401;
      return next(err);
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      const err = new Error('Invalid credentials');
      err.statusCode = 401;
      return next(err);
    }

    const token = jwt.sign(
      { userId: user._id.toString() },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.cookie('token', token, COOKIE_OPTIONS);

    // Return user without password
    const { password: _pw, ...userPayload } = user.toObject();
    res.status(200).json({ success: true, user: userPayload });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/auth/me
 * Protected by authenticate middleware — req.user is already populated.
 * Returns the cached/fetched user object.
 */
const me = (req, res) => {
  res.status(200).json({ success: true, user: req.user });
};

/**
 * POST /api/auth/logout
 * Protected by authenticate middleware.
 * Clears the token cookie and invalidates the Redis cache entry.
 */
const logout = async (req, res, next) => {
  try {
    // Invalidate Redis cache for this user
    const redis = getRedisClient();
    await redis.del(`user:${req.user._id}`);

    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Strict',
    });

    res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
};

module.exports = { login, me, logout };

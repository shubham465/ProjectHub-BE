const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { getRedisClient } = require('../config/redis');

/**
 * Middleware — reads JWT from HttpOnly cookie, verifies it, then:
 *   1. Checks Redis for a cached user object (fast path)
 *   2. Falls back to MongoDB and caches the result in Redis (slow path)
 * Attaches the user doc to req.user on success.
 * Forwards a 401 AppError on any failure.
 */
const authenticate = async (req, res, next) => {
  try {
    const token = req.cookies?.token;
    if (!token) {
      const err = new Error('Not authenticated — no token');
      err.statusCode = 401;
      return next(err);
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      const err = new Error('Not authenticated — invalid token');
      err.statusCode = 401;
      return next(err);
    }

    const redis = getRedisClient();
    const cacheKey = `user:${decoded.userId}`;

    // 1. Try Redis cache
    const cached = await redis.get(cacheKey);
    if (cached) {
      req.user = JSON.parse(cached);
      return next();
    }

    // 2. Fall back to DB
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      const err = new Error('Not authenticated — user not found');
      err.statusCode = 401;
      return next(err);
    }

    // Cache for 15 minutes (900 seconds)
    await redis.set(cacheKey, JSON.stringify(user), 'EX', 900);

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = authenticate;

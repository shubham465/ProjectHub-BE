'use strict';

/**
 * Socket.IO server — initialisation, auth middleware, and singleton accessor.
 *
 * Usage:
 *   const { initSocket, getIO } = require('./socket');
 *
 *   // In server.js (once, after http.Server is created):
 *   initSocket(httpServer);
 *
 *   // Anywhere else (e.g. task controller) to emit events:
 *   getIO().to(room).emit('TASK_UPDATED', payload);
 */

const { Server } = require('socket.io');
const cookie = require('cookie');
const jwt = require('jsonwebtoken');
const { getRedisClient } = require('../config/redis');
const User = require('../models/User');
const { registerHandlers } = require('./handlers');

let io;

/**
 * Initialise Socket.IO attached to an existing http.Server.
 * Returns the io instance (also stored as a module-level singleton).
 *
 * @param {import('http').Server} httpServer
 * @returns {import('socket.io').Server}
 */
const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_ORIGIN || 'http://localhost:3000',
      credentials: true,
    },
  });

  // ── Authentication middleware ────────────────────────────────────────────
  io.use(async (socket, next) => {
    try {
      // Socket.IO handshake carries headers; parse the Cookie header manually.
      const rawCookie = socket.handshake.headers.cookie || '';
      const cookies = cookie.parse(rawCookie);
      const token = cookies.token;

      if (!token) {
        return next(new Error('Not authenticated — no token'));
      }

      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch {
        return next(new Error('Not authenticated — invalid token'));
      }

      // Redis-first, MongoDB-fallback (mirrors authenticate.js middleware)
      const redis = getRedisClient();
      const cacheKey = `user:${decoded.userId}`;
      const cached = await redis.get(cacheKey);

      if (cached) {
        socket.user = JSON.parse(cached);
        return next();
      }

      const user = await User.findById(decoded.userId).select('-password');
      if (!user) {
        return next(new Error('Not authenticated — user not found'));
      }

      await redis.set(cacheKey, JSON.stringify(user), 'EX', 900);
      socket.user = user;
      next();
    } catch (err) {
      next(err);
    }
  });

  // ── Connection handler ───────────────────────────────────────────────────
  io.on('connection', (socket) => {
    registerHandlers(socket);
  });

  return io;
};

/**
 * Return the initialised Socket.IO instance.
 * Throws if initSocket() was never called (prevents silent no-ops).
 */
const getIO = () => {
  if (!io) throw new Error('Socket.IO not initialised. Call initSocket(httpServer) first.');
  return io;
};

module.exports = { initSocket, getIO };

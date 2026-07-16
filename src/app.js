const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const authRoutes = require('./routes/auth.routes');
const projectRoutes = require('./routes/project.routes');
const taskRoutes = require('./routes/task.routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// ─── Core Middleware ──────────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:3000',
    credentials: true, // Required for HttpOnly cookies cross-origin
  })
);
app.use(express.json());
app.use(cookieParser());

const userRoutes = require('./routes/user.routes');

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);

// ─── Global Error Handler (must be last) ─────────────────────────────────────
app.use(errorHandler);

module.exports = app;

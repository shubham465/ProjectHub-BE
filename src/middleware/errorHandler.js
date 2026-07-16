/**
 * Global Express error-handling middleware.
 * Always returns a consistent JSON shape: { success: false, message }.
 * Mount this LAST in app.js, after all routes.
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    message,
  });
};

module.exports = errorHandler;

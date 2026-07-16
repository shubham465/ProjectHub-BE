/**
 * Middleware — ensures the authenticated user has the 'Admin' role.
 * Must be used after the `authenticate` middleware.
 */
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'Admin') {
    const err = new Error('Forbidden: Admin access required');
    err.statusCode = 403;
    return next(err);
  }
  next();
};

module.exports = requireAdmin;

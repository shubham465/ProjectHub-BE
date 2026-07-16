const requireAdmin = require('../middleware/requireAdmin');

describe('requireAdmin middleware', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = { user: {} };
    res = {};
    next = jest.fn();
  });

  it('should call next() with 403 AppError if user role is not Admin', () => {
    req.user.role = 'Member';

    requireAdmin(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toMatch(/forbidden/i);
    expect(err.statusCode).toBe(403);
  });

  it('should call next() with 403 AppError if user is not attached to req', () => {
    req.user = undefined;

    requireAdmin(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toMatch(/forbidden/i);
    expect(err.statusCode).toBe(403);
  });

  it('should call next() with no arguments if user role is Admin', () => {
    req.user.role = 'Admin';

    requireAdmin(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });
});

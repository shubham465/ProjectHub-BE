'use strict';

const User = require('../models/User');

class UserService {
  /**
   * List all users.
   * @returns {Promise<Array>} Array of users (passwords excluded).
   */
  static async listUsers() {
    return User.find().select('-password').sort({ createdAt: -1 });
  }

  /**
   * Create a new user.
   * @param {Object} userData - { name, email, password, role }
   * @returns {Promise<Object>} Created user object (password excluded).
   */
  static async createUser({ name, email, password, role }) {
    // Check if email already exists
    const existing = await User.findOne({ email });
    if (existing) {
      const err = new Error('Email already in use');
      err.statusCode = 400;
      throw err;
    }

    const user = new User({ name, email, password, role });
    await user.save();
    
    // Return a lean object without the password
    const userObj = user.toObject();
    delete userObj.password;
    return userObj;
  }

  /**
   * Update an existing user.
   * @param {string} userId - User ID to update
   * @param {Object} requestingUser - The authenticated user making the request
   * @param {Object} updates - Fields to update (name, email, role)
   * @returns {Promise<Object>} Updated user object (password excluded).
   * @throws {Error} 403 if an Admin attempts to modify another Admin.
   * @throws {Error} 404 if the target user is not found.
   */
  static async updateUser(userId, requestingUser, updates) {
    const user = await User.findById(userId);
    if (!user) {
      const err = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }

    // Admins cannot modify other Admin accounts
    if (
      user.role === 'Admin' &&
      requestingUser &&
      requestingUser._id.toString() !== userId.toString()
    ) {
      const err = new Error('Admins cannot modify other Admin accounts');
      err.statusCode = 403;
      throw err;
    }

    // Only update fields that are provided
    if (updates.name !== undefined) user.name = updates.name;
    if (updates.email !== undefined) user.email = updates.email;
    if (updates.role !== undefined) user.role = updates.role;

    await user.save();

    const userObj = user.toObject();
    delete userObj.password;
    return userObj;
  }
}

module.exports = UserService;

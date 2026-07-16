'use strict';

const UserService = require('../services/user.service');

const listUsers = async (req, res, next) => {
  try {
    const users = await UserService.listUsers();
    res.status(200).json({ success: true, users });
  } catch (err) {
    next(err);
  }
};

const createUser = async (req, res, next) => {
  try {
    const user = await UserService.createUser(req.body);
    res.status(201).json({ success: true, user });
  } catch (err) {
    next(err);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const user = await UserService.updateUser(req.params.id, req.user, req.body);
    res.status(200).json({ success: true, user });
  } catch (err) {
    next(err);
  }
};

module.exports = { listUsers, createUser, updateUser };

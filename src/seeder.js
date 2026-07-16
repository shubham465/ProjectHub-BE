'use strict';

/**
 * seedDevUsers — Development-only database seeder.
 *
 * Accepts a UserModel (Mongoose model or compatible double) so the function
 * remains independently testable without a live database connection.
 *
 * @param {object} UserModel - A Mongoose User model (or compatible interface).
 */
const seedDevUsers = async (UserModel) => {
  const count = await UserModel.countDocuments();
  if (count > 0) {
    console.log('[Seeder] Users already exist — skipping dev seed.');
    return;
  }

  console.log('[Seeder] User collection is empty — seeding mock dev users...');

  await UserModel.create({
    name: 'Shubham Khot',
    email: 'skhot@projecthub.com',
    password: '0608Shubham@123',
    role: 'Admin',
  });

  await UserModel.create({
    name: 'John Doe',
    email: 'jdoe@projecthub.com',
    password: '0608John@123',
    role: 'Member',
  });

  console.log('[Seeder] Seeded: Alice Admin (Admin) and Bob Member (Member).');
};

module.exports = { seedDevUsers };

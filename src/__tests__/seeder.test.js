'use strict';

/**
 * Dev Seeder Tests — Unit seam (seedDevUsers function)
 *
 * Seam under test (pre-agreed):
 *   seedDevUsers(UserModel) — creates one Admin and one Member when the
 *   User collection is empty, and skips seeding when users already exist.
 *
 * The UserModel is injected so tests can provide a controlled double.
 */

const { seedDevUsers } = require('../seeder');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a minimal UserModel double */
const makeUserModel = ({ countDocuments = 0 } = {}) => {
  const created = [];
  return {
    countDocuments: jest.fn().mockResolvedValue(countDocuments),
    create: jest.fn().mockImplementation(async (doc) => {
      created.push(doc);
      return doc;
    }),
    _created: created,
  };
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('seedDevUsers', () => {
  it('creates one Admin and one Member when the User collection is empty', async () => {
    const UserModel = makeUserModel({ countDocuments: 0 });

    await seedDevUsers(UserModel);

    expect(UserModel.create).toHaveBeenCalledTimes(2);

    const roles = UserModel._created.map((u) => u.role);
    expect(roles).toContain('Admin');
    expect(roles).toContain('Member');
  });

  it('skips seeding when users already exist', async () => {
    const UserModel = makeUserModel({ countDocuments: 3 });

    await seedDevUsers(UserModel);

    expect(UserModel.create).not.toHaveBeenCalled();
  });

  it('seeded Admin user has a name and email', async () => {
    const UserModel = makeUserModel({ countDocuments: 0 });

    await seedDevUsers(UserModel);

    const admin = UserModel._created.find((u) => u.role === 'Admin');
    expect(admin).toBeDefined();
    expect(typeof admin.name).toBe('string');
    expect(admin.name.length).toBeGreaterThan(0);
    expect(typeof admin.email).toBe('string');
    expect(admin.email).toMatch(/@/);
  });

  it('seeded Member user has a name and email', async () => {
    const UserModel = makeUserModel({ countDocuments: 0 });

    await seedDevUsers(UserModel);

    const member = UserModel._created.find((u) => u.role === 'Member');
    expect(member).toBeDefined();
    expect(typeof member.name).toBe('string');
    expect(member.name.length).toBeGreaterThan(0);
    expect(typeof member.email).toBe('string');
    expect(member.email).toMatch(/@/);
  });
});

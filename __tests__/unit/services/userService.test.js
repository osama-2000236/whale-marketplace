const userService = require('../../../services/userService');
const { createTestUser, cleanTestData, skipIfNoDb } = require('../../helpers/db');

const DB_SKIP_MSG = 'Skipped: database not available';

afterAll(async () => {
  if (!skipIfNoDb()) await cleanTestData();
});

describe('user service', () => {
  test('findByUsername returns user', async () => {
    if (skipIfNoDb()) return console.log(DB_SKIP_MSG);
    const user = await createTestUser({ username: 'test_find_me' });
    const found = await userService.findByUsername('test_find_me');
    expect(found.id).toBe(user.id);
  });

  test('findByUsername returns null for missing user', async () => {
    if (skipIfNoDb()) return console.log(DB_SKIP_MSG);
    const found = await userService.findByUsername('definitely_does_not_exist_xyz');
    expect(found).toBeNull();
  });
});

const userService = require('../../../services/userService');
const { createTestUser, cleanTestData } = require('../../helpers/db');

afterAll(async () => {
  await cleanTestData();
});

describe('user service', () => {
  test('findByUsername returns user', async () => {
    const user = await createTestUser({ username: 'test_find_me' });
    const found = await userService.findByUsername('test_find_me');
    expect(found.id).toBe(user.id);
  });

  test('findByUsername returns null for missing user', async () => {
    const found = await userService.findByUsername('definitely_does_not_exist_xyz');
    expect(found).toBeNull();
  });
});

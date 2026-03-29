const { MIGRATE_DEPLOY_COMMAND, SEED_COMMAND, boot } = require('../entrypoint');

describe('entrypoint boot', () => {
  let logSpy;
  let errorSpy;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  test('aborts startup when migrations fail and never attempts schema reset', () => {
    const migrationError = new Error('migrate failed');
    migrationError.stderr = Buffer.from('migration failed');

    const runCommand = jest.fn(() => {
      throw migrationError;
    });
    const startServer = jest.fn();

    expect(() => boot({ runCommand, startServer })).toThrow('migrate failed');
    expect(runCommand).toHaveBeenCalledTimes(1);
    expect(runCommand).toHaveBeenCalledWith(MIGRATE_DEPLOY_COMMAND);
    expect(startServer).not.toHaveBeenCalled();
    expect(runCommand.mock.calls.flat().join(' ')).not.toContain('DROP SCHEMA');
  });

  test('continues to start the server when seed fails after a successful migration', () => {
    const seedError = new Error('seed failed');
    seedError.stderr = Buffer.from('seed failed');

    const runCommand = jest
      .fn()
      .mockReturnValueOnce(Buffer.from('migrated'))
      .mockImplementationOnce(() => {
        throw seedError;
      });
    const startServer = jest.fn();

    boot({ runCommand, startServer, bootSeed: true });

    expect(runCommand).toHaveBeenNthCalledWith(1, MIGRATE_DEPLOY_COMMAND);
    expect(runCommand).toHaveBeenNthCalledWith(2, SEED_COMMAND);
    expect(startServer).toHaveBeenCalledTimes(1);
  });
});

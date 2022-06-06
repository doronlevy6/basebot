import { loadEnvs } from './env';
import { IInitialEnv } from './types';

describe('env', () => {
  it('should load override env to process.env', () => {
    process.env['NODE_OVERRIDE_ENV'] = 'local';
    const initialEnv: IInitialEnv = {
      cwd: process.cwd(),
      env: 'test',
      serviceName: 'test',
    };
    loadEnvs(initialEnv, ['configs']);
    expect(process.env['ENV']).toEqual('local');
  });
});

import { loadEnvs } from './env';
import { IInitialEnv } from './types';

describe('env', () => {
  it('should load env to process.env', () => {
    const initialEnv: IInitialEnv = {
      cwd: process.cwd(),
      env: 'test',
    };
    loadEnvs(initialEnv, ['configs']);
    expect(process.env['PORT']).toEqual('3333');
  });

  it('should load override env to process.env', () => {
    process.env['NODE_ENV_OVERRIDE'] = 'local';
    const initialEnv: IInitialEnv = {
      cwd: process.cwd(),
      env: 'test',
    };
    loadEnvs(initialEnv, ['configs']);
    expect(process.env['ENV']).toEqual('local');
  });
});

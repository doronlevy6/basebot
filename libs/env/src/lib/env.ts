import * as dotenv from 'dotenv';
import * as path from 'path';
import { IInitialEnv } from './types';

export const loadEnvs = (initialEnv: IInitialEnv, envTypes: string[]) => {
  if (process.env['NODE_OVERRIDE_ENV']) {
    initialEnv.env = process.env['NODE_OVERRIDE_ENV'];
  }

  for (let i = 0; i < envTypes.length; i++) {
    const envType = envTypes[i];
    const envPath = path.resolve(
      initialEnv.cwd,
      envType,
      initialEnv.env + '.env',
    );

    console.info('Loading env ' + envPath);
    const result = dotenv.config({
      path: envPath,
    });

    if (result.error) {
      throw result.error;
    }

    console.info('Successfully loaded env ' + envPath);
  }

  process.env['SERVICE_NAME'] = initialEnv.serviceName;
};

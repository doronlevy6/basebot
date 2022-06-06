import { Logger } from './lib/logger';
import * as Types from './lib/types';

export type ILogger = Types.ILogger;

const isProduction = process.env['NODE_ENV'] !== 'production';

export const logger: ILogger = new Logger({
  level: process.env['DEFAULT_LOG_LEVEL'] || 'info',
  service: process.env['SERVICE_NAME'],
  pretty: !isProduction,
});

export { Logger };

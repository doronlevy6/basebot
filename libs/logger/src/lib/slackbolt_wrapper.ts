/* eslint-disable @typescript-eslint/no-explicit-any */
import { Logger as BoltLogger, LogLevel } from '@slack/logger';
import { ILogger, logLevelFromString } from './types';

export class BoltWrapper implements BoltLogger {
  private logger: ILogger;

  constructor(logger: ILogger) {
    this.logger = logger;
  }

  debug(...msg: any[]): void {
    this.logger.debug({ message: msg, origin: 'bolt' });
  }

  info(...msg: any[]): void {
    this.logger.info({ message: msg, origin: 'bolt' });
  }

  warn(...msg: any[]): void {
    this.logger.warn({ message: msg, origin: 'bolt' });
  }
  error(...msg: any[]): void {
    this.logger.error({ message: msg, origin: 'bolt' });
  }

  setLevel(level: LogLevel): void {
    this.logger.setLevel(logLevelFromString(level));
  }

  getLevel(): LogLevel {
    const level = this.logger.getLevel();
    switch (level) {
      case 0:
        return LogLevel.DEBUG;
      case 1:
        return LogLevel.INFO;
      case 2:
        return LogLevel.WARN;
      case 3:
        return LogLevel.ERROR;
      default:
        return LogLevel.INFO;
    }
  }

  setName(name: string): void {
    this.logger.setName(name);
  }
}

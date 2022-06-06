/* eslint-disable no-console */

import { IConfig, ILogger, LogLevel, logLevelFromString } from './types';

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type logFunc = (...data: any[]) => void;

export class Logger implements ILogger {
  private cfg: IConfig;
  private level: LogLevel;

  constructor(config: IConfig) {
    this.cfg = config;
    this.level = logLevelFromString(config.level);
  }

  public debug(message: string | object) {
    if (this.level > LogLevel.Debug) {
      return;
    }

    this.leveledLog('debug', message, console.debug);
  }

  public info(message: string | object) {
    if (this.level > LogLevel.Info) {
      return;
    }

    this.leveledLog('info', message, console.info);
  }

  public warn(message: string | object) {
    if (this.level > LogLevel.Warn) {
      return;
    }

    this.leveledLog('warn', message, console.warn);
  }

  public error(message: string | object) {
    if (this.level > LogLevel.Error) {
      return;
    }

    this.leveledLog('error', message, console.error);
  }

  private leveledLog(level: string, message: string | object, logger: logFunc) {
    let log = message;
    if (typeof message === 'object') {
      log = JSON.stringify(message);
    }

    logger(
      JSON.stringify({
        ...this.cfg.defaultMeta,
        level: level,
        service: this.cfg.service || 'frontend',
        message: log,
      }),
    );
  }
}

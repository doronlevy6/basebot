export interface ILogger {
  debug: (message: string | object) => void;
  info: (message: string | object) => void;
  warn: (message: string | object) => void;
  error: (message: string | object) => void;
  setName: (name: string) => void;
  getLevel: () => LogLevel;
  setLevel: (level: LogLevel) => void;
}

export interface IConfig {
  level: string;
  service?: string;
  defaultMeta?: { [key: string]: string };
  pretty: boolean;
}

export enum LogLevel {
  Debug,
  Info,
  Warn,
  Error,
}

export function logLevelFromString(logLevel: string): LogLevel {
  switch (logLevel.toLowerCase()) {
    case 'debug':
      return LogLevel.Debug;
    case 'info':
      return LogLevel.Info;
    case 'warn':
      return LogLevel.Warn;
    case 'error':
      return LogLevel.Error;
    default:
      return LogLevel.Info;
  }
}

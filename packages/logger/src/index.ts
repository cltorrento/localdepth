export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LoggerOptions {
  service: string;
}

export class Logger {
  private service: string;

  constructor(options: LoggerOptions) {
    this.service = options.service;
  }

  private format(level: LogLevel, message: string, meta?: Record<string, any>) {
    const timestamp = new Date().toISOString();
    return JSON.stringify({
      timestamp,
      level,
      service: this.service,
      message,
      ...(meta ? { meta } : {}),
    });
  }

  debug(message: string, meta?: Record<string, any>) {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(this.format('debug', message, meta));
    }
  }

  info(message: string, meta?: Record<string, any>) {
    console.log(this.format('info', message, meta));
  }

  warn(message: string, meta?: Record<string, any>) {
    console.warn(this.format('warn', message, meta));
  }

  error(message: string, meta?: Record<string, any>) {
    console.error(this.format('error', message, meta));
  }
}

export function createLogger(service: string): Logger {
  return new Logger({ service });
}

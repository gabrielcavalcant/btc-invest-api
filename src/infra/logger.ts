import pino from 'pino';

/** Minimal logger contract used by infra adapters (satisfied by pino and Fastify's logger). */
export interface Logger {
  debug(obj: object | string, msg?: string): void;
  info(obj: object | string, msg?: string): void;
  warn(obj: object | string, msg?: string): void;
  error(obj: object | string, msg?: string): void;
}

export function loggerOptions(env: { NODE_ENV: string; LOG_LEVEL: string }) {
  return {
    level: env.LOG_LEVEL,
    // never write secrets to the logs
    redact: {
      paths: ['req.headers.authorization', 'password', '*.password', 'token', '*.token'],
      censor: '[REDACTED]',
    },
    ...(env.NODE_ENV === 'development'
      ? {
          transport: {
            target: 'pino-pretty',
            options: { translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
          },
        }
      : {}),
  };
}

export function createLogger(env: { NODE_ENV: string; LOG_LEVEL: string }) {
  return pino(loggerOptions(env));
}

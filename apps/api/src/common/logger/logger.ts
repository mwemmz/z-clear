import { Injectable, type LoggerService } from '@nestjs/common';
import { pino, type Logger } from 'pino';
import type { AppEnv } from '../../config/env';

const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["set-cookie"]',
  'res.headers["set-cookie"]',
  'password',
  'passwordHash',
  'token',
  'accessToken',
  'refreshToken',
  '*.password',
  '*.token',
  '*.secret',
  '*.taxNumber',
  '*.email',
  '*.phone',
];

export function createRootLogger(env: AppEnv): Logger {
  const isDev = env.NODE_ENV === 'development';
  return pino({
    level: env.LOG_LEVEL,
    redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
    base: { service: 'api', version: env.APP_VERSION },
    ...(isDev
      ? {
          transport: {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'SYS:standard' },
          },
        }
      : {}),
  });
}

/** Adapts a pino logger to Nest's LoggerService so framework logs are structured too. */
@Injectable()
export class PinoNestLogger implements LoggerService {
  constructor(private readonly logger: Logger) {}

  log(message: unknown, context?: string): void {
    this.logger.info({ context }, stringify(message));
  }

  error(message: unknown, stack?: string, context?: string): void {
    this.logger.error({ context, stack }, stringify(message));
  }

  warn(message: unknown, context?: string): void {
    this.logger.warn({ context }, stringify(message));
  }

  debug(message: unknown, context?: string): void {
    this.logger.debug({ context }, stringify(message));
  }

  verbose(message: unknown, context?: string): void {
    this.logger.trace({ context }, stringify(message));
  }
}

function stringify(message: unknown): string {
  if (typeof message === 'string') {
    return message;
  }
  try {
    return JSON.stringify(message);
  } catch {
    return String(message);
  }
}

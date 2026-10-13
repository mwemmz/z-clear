import {
  Catch,
  HttpException,
  HttpStatus,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Logger } from 'pino';
import type { Request, Response } from 'express';
import { ApiError, ErrorCode } from './api-error';
import { buildErrorEnvelope } from './error-envelope';
import { getRequestId } from '../http/request-context';

const HTTP_CODE_MAP: Record<number, ErrorCode> = {
  [HttpStatus.BAD_REQUEST]: ErrorCode.VALIDATION_ERROR,
  [HttpStatus.UNAUTHORIZED]: ErrorCode.UNAUTHENTICATED,
  [HttpStatus.FORBIDDEN]: ErrorCode.FORBIDDEN,
  [HttpStatus.NOT_FOUND]: ErrorCode.NOT_FOUND,
  [HttpStatus.CONFLICT]: ErrorCode.CONFLICT,
  [HttpStatus.TOO_MANY_REQUESTS]: ErrorCode.RATE_LIMITED,
};

/**
 * Converts every thrown error into the single API error envelope. Unknown
 * errors are logged in full server-side but returned with a generic message so
 * stack traces and internals never reach clients.
 */
@Catch()
export class ApiExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = getRequestId(request);

    const { status, code, message, details } = this.normalize(exception);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        { requestId, method: request.method, path: request.url, err: exception },
        'request failed',
      );
    } else {
      this.logger.warn(
        { requestId, method: request.method, path: request.url, code, status },
        'request rejected',
      );
    }

    response.status(status).json(buildErrorEnvelope(code, message, requestId, details));
  }

  private normalize(exception: unknown): {
    status: number;
    code: ErrorCode;
    message: string;
    details: { field?: string; issue: string }[];
  } {
    if (exception instanceof ApiError) {
      return {
        status: exception.status,
        code: exception.code,
        message: exception.message,
        details: exception.details,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const code = HTTP_CODE_MAP[status] ?? ErrorCode.INTERNAL_ERROR;
      const message = messageFromHttpException(exception, code);
      return { status, code, message, details: [] };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ErrorCode.INTERNAL_ERROR,
      message: 'An unexpected error occurred',
      details: [],
    };
  }
}

function messageFromHttpException(exception: HttpException, code: ErrorCode): string {
  if (code === ErrorCode.INTERNAL_ERROR) {
    return 'An unexpected error occurred';
  }
  const response = exception.getResponse();
  if (typeof response === 'string') {
    return response;
  }
  if (typeof response === 'object' && response !== null && 'message' in response) {
    const message = (response as { message: unknown }).message;
    if (typeof message === 'string') {
      return message;
    }
    if (Array.isArray(message)) {
      return message.map(String).join('; ');
    }
  }
  return exception.message;
}

export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface ErrorDetail {
  field?: string;
  issue: string;
}

/**
 * Application error with a stable machine code. Messages are safe to show to
 * clients: never include secrets, stack traces, or internal identifiers.
 */
export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details: ErrorDetail[];

  constructor(code: ErrorCode, status: number, message: string, details: ErrorDetail[] = []) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }

  static validation(message: string, details: ErrorDetail[] = []): ApiError {
    return new ApiError(ErrorCode.VALIDATION_ERROR, 400, message, details);
  }

  static unauthenticated(message = 'Authentication required'): ApiError {
    return new ApiError(ErrorCode.UNAUTHENTICATED, 401, message);
  }

  static forbidden(message = 'Not permitted'): ApiError {
    return new ApiError(ErrorCode.FORBIDDEN, 403, message);
  }

  static notFound(message = 'Not found'): ApiError {
    return new ApiError(ErrorCode.NOT_FOUND, 404, message);
  }

  static conflict(message: string): ApiError {
    return new ApiError(ErrorCode.CONFLICT, 409, message);
  }

  static payloadTooLarge(message: string): ApiError {
    return new ApiError(ErrorCode.PAYLOAD_TOO_LARGE, 413, message);
  }

  static internal(message = 'An unexpected error occurred'): ApiError {
    return new ApiError(ErrorCode.INTERNAL_ERROR, 500, message);
  }
}

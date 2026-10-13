import type { ErrorCode, ErrorDetail } from './api-error';

/** The single, consistent error shape every API endpoint returns. */
export interface ErrorEnvelope {
  error: {
    code: ErrorCode;
    message: string;
    details: ErrorDetail[];
    requestId: string;
  };
}

export function buildErrorEnvelope(
  code: ErrorCode,
  message: string,
  requestId: string,
  details: ErrorDetail[] = [],
): ErrorEnvelope {
  return { error: { code, message, details, requestId } };
}

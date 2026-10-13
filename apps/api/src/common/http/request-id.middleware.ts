import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { RequestWithContext } from './request-context';

const MAX_INBOUND_ID_LENGTH = 128;

/**
 * Assigns a correlation id to every request (trusting an inbound x-request-id
 * only within sane bounds) and echoes it back for support and log correlation.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const inbound = req.headers['x-request-id'];
  const requestId =
    typeof inbound === 'string' && inbound.length > 0 && inbound.length <= MAX_INBOUND_ID_LENGTH
      ? inbound
      : randomUUID();

  (req as RequestWithContext).requestId = requestId;
  res.setHeader('x-request-id', requestId);
  next();
}

import type { Request } from 'express';

export interface RequestWithContext extends Request {
  requestId: string;
}

export function getRequestId(req: Request): string {
  const withContext = req as Partial<RequestWithContext>;
  return typeof withContext.requestId === 'string' ? withContext.requestId : 'unknown';
}

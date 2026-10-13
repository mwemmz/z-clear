import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { pino } from 'pino';
import { ApiError } from './api-error';
import { ApiExceptionsFilter } from './api-exceptions.filter';

function createHost(): {
  host: ArgumentsHost;
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
} {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ method: 'GET', url: '/x', requestId: 'req-1' }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

const logger = pino({ level: 'silent' });

describe('ApiExceptionsFilter', () => {
  it('maps ApiError to the error envelope', () => {
    const { host, status, json } = createHost();
    new ApiExceptionsFilter(logger).catch(ApiError.notFound('No such shipment'), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({
      error: {
        code: 'NOT_FOUND',
        message: 'No such shipment',
        details: [],
        requestId: 'req-1',
      },
    });
  });

  it('maps HttpException and preserves the message', () => {
    const { host, status, json } = createHost();
    new ApiExceptionsFilter(logger).catch(new BadRequestException('Bad input'), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json.mock.calls[0]?.[0].error.code).toBe('VALIDATION_ERROR');
    expect(json.mock.calls[0]?.[0].error.message).toBe('Bad input');
  });

  it('hides internals for unknown errors', () => {
    const { host, status, json } = createHost();
    new ApiExceptionsFilter(logger).catch(new Error('secret db string'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json.mock.calls[0]?.[0].error.message).toBe('An unexpected error occurred');
    expect(JSON.stringify(json.mock.calls[0]?.[0])).not.toContain('secret db string');
  });
});

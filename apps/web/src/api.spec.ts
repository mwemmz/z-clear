import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiBase } from './api';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('apiBase', () => {
  it('uses the same-origin /api proxy when no origin is configured', () => {
    vi.stubEnv('VITE_API_ORIGIN', '');
    expect(apiBase()).toBe('/api/v1');
  });

  it('uses the deployed API origin and drops trailing slashes', () => {
    vi.stubEnv('VITE_API_ORIGIN', 'https://zclear-api.onrender.com/');
    expect(apiBase()).toBe('https://zclear-api.onrender.com/api/v1');
  });
});

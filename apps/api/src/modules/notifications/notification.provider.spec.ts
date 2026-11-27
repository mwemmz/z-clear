import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { loadEnv } from '../../config/env';
import {
  EmailWebhookNotificationProvider,
  MockNotificationProvider,
  SmsMockNotificationProvider,
  notificationProviderFromEnv,
} from './notification.provider';

const servers: Array<ReturnType<typeof createServer>> = [];

afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
  );
});

async function webhook(status: number, capture: (body: string, auth: string | undefined) => void) {
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      capture(body, req.headers.authorization);
      res.writeHead(status);
      res.end('ok');
    });
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

describe('notification providers', () => {
  it('mock provider skips delivery', async () => {
    const result = await new MockNotificationProvider().send({
      to: 'synthetic@example.com',
      subject: 'subject',
      body: 'body',
    });
    expect(result.status).toBe('skipped');
  });

  it('SMS mock records a skipped outcome without sending anything', async () => {
    const provider = new SmsMockNotificationProvider();
    expect(provider.channel).toBe('sms_mock');
    const result = await provider.send({
      to: '+260970000000',
      subject: 'Case update',
      body: 'Your case moved to review.',
    });
    expect(result.status).toBe('skipped');
    expect(result.detail).toMatch(/nothing sent/);
  });

  it('email webhook posts a provider-neutral payload with a bearer token', async () => {
    let payload = '';
    let auth: string | undefined;
    const url = await webhook(200, (body, authorization) => {
      payload = body;
      auth = authorization;
    });
    const provider = new EmailWebhookNotificationProvider(
      'sender@example.com',
      url,
      'test-token',
      2_000,
    );
    const result = await provider.send({
      to: 'recipient@example.com',
      subject: 'Invoice issued',
      body: 'Invoice INV-1 was issued.',
    });
    expect(result.status).toBe('sent');
    expect(JSON.parse(payload)).toEqual({
      from: 'sender@example.com',
      to: 'recipient@example.com',
      subject: 'Invoice issued',
      text: 'Invoice INV-1 was issued.',
    });
    expect(auth).toBe('Bearer test-token');
  });

  it('email webhook reports failure on a non-2xx response', async () => {
    const url = await webhook(500, () => undefined);
    const provider = new EmailWebhookNotificationProvider(
      'sender@example.com',
      url,
      undefined,
      2_000,
    );
    const result = await provider.send({
      to: 'recipient@example.com',
      subject: 'subject',
      body: 'body',
    });
    expect(result.status).toBe('failed');
    expect(result.detail).toContain('500');
  });

  it.each(['sms', 'whatsapp'] as const)(
    'factory fails closed for unimplemented provider %s',
    (name) => {
      const env = {
        ...loadEnv({}),
        FEATURE_NOTIFICATIONS: true,
        NOTIFICATION_PROVIDER: name,
        NOTIFICATION_FROM: 'sender@example.com',
        NOTIFICATION_WEBHOOK_URL: 'https://example.com/notify',
      };
      expect(() => notificationProviderFromEnv(env)).toThrow(/roadmap, not implemented/);
    },
  );

  it('factory returns the SMS mock when configured and the feature is on', () => {
    const provider = notificationProviderFromEnv({
      ...loadEnv({}),
      FEATURE_NOTIFICATIONS: true,
      NOTIFICATION_PROVIDER: 'sms_mock',
    });
    expect(provider.channel).toBe('sms_mock');
  });

  it('factory returns the mock provider when the feature is off', () => {
    const provider = notificationProviderFromEnv(loadEnv({}));
    expect(provider.channel).toBe('mock');
  });
});

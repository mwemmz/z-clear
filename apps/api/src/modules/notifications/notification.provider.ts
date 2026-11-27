import type { AppEnv } from '../../config/env';

export type NotificationChannel = 'email' | 'mock';
export type DeliveryStatus = 'sent' | 'skipped' | 'failed';

export interface NotificationMessage {
  to: string;
  subject: string;
  body: string;
}

export interface DeliveryResult {
  status: DeliveryStatus;
  detail?: string;
}

/**
 * Delivery seam. No addresses live in code or fixtures: recipients are resolved
 * from tenant users at emit time, and the sender comes from configuration.
 */
export interface NotificationProvider {
  readonly channel: NotificationChannel;
  send(message: NotificationMessage): Promise<DeliveryResult>;
}

export const NOTIFICATION_PROVIDER_TOKEN = Symbol('NOTIFICATION_PROVIDER');

/** Dev/test default: records the event without sending anything. */
export class MockNotificationProvider implements NotificationProvider {
  readonly channel = 'mock' as const;

  async send(_message: NotificationMessage): Promise<DeliveryResult> {
    return { status: 'skipped', detail: 'mock provider: nothing sent' };
  }
}

/**
 * Generic transactional-email webhook. Configure `NOTIFICATION_WEBHOOK_URL`
 * with your email provider's endpoint and `NOTIFICATION_WEBHOOK_TOKEN` with its
 * bearer token. The payload is intentionally minimal and provider-neutral.
 */
export class EmailWebhookNotificationProvider implements NotificationProvider {
  readonly channel = 'email' as const;

  constructor(
    private readonly from: string,
    private readonly url: string,
    private readonly token: string | undefined,
    private readonly timeoutMs: number,
  ) {}

  async send(message: NotificationMessage): Promise<DeliveryResult> {
    try {
      const response = await fetch(this.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
        },
        body: JSON.stringify({
          from: this.from,
          to: message.to,
          subject: message.subject,
          text: message.body,
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!response.ok) {
        return { status: 'failed', detail: `email webhook returned ${response.status}` };
      }
      return { status: 'sent' };
    } catch (error) {
      return {
        status: 'failed',
        detail: error instanceof Error ? error.message : 'email webhook failed',
      };
    }
  }
}

/** Fail closed: an unimplemented provider must never silently drop messages. */
export function notificationProviderFromEnv(env: AppEnv): NotificationProvider {
  if (!env.FEATURE_NOTIFICATIONS || env.NOTIFICATION_PROVIDER === 'mock') {
    return new MockNotificationProvider();
  }
  if (env.NOTIFICATION_PROVIDER === 'email') {
    if (!env.NOTIFICATION_FROM || !env.NOTIFICATION_WEBHOOK_URL) {
      throw new Error(
        'NOTIFICATION_FROM and NOTIFICATION_WEBHOOK_URL are required when email notifications are enabled',
      );
    }
    return new EmailWebhookNotificationProvider(
      env.NOTIFICATION_FROM,
      env.NOTIFICATION_WEBHOOK_URL,
      env.NOTIFICATION_WEBHOOK_TOKEN,
      env.NOTIFICATION_TIMEOUT_MS,
    );
  }
  throw new Error(
    `Notification provider '${env.NOTIFICATION_PROVIDER}' is roadmap, not implemented; use mock or email`,
  );
}

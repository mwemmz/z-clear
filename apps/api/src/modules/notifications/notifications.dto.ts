import { z } from 'zod';

/**
 * Read model for the append-only notification outbox. Recipient email and phone
 * are deliberately not selected: this endpoint exists to show delivery status
 * to the people involved, not to expose contact details.
 */
export const listNotificationsSchema = z
  .object({
    eventType: z.string().trim().min(1).max(100).optional(),
    status: z.enum(['sent', 'skipped', 'failed']).optional(),
    channel: z.enum(['email', 'mock', 'sms_mock']).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

export type ListNotificationsQuery = z.infer<typeof listNotificationsSchema>;

export interface NotificationView {
  id: string;
  eventType: string;
  entityType: string | null;
  entityId: string | null;
  channel: 'email' | 'mock' | 'sms_mock';
  status: 'sent' | 'skipped' | 'failed';
  /** Provider-neutral outcome text; never a recipient address. */
  detail: string | null;
  subject: string;
  createdAt: string;
}

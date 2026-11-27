import { Inject, Injectable } from '@nestjs/common';
import { uuidv7 } from '../../common/ids';
import { DatabaseService } from '../../database/database.service';
import { AuditService } from '../audit/audit.service';
import type { RequestMeta } from '../auth/auth.service';
import {
  NOTIFICATION_PROVIDER_TOKEN,
  type DeliveryResult,
  type NotificationProvider,
} from './notification.provider';

export type NotificationAudience = 'agency' | 'importer' | 'both';

export interface EmitNotificationInput {
  tenantId: string;
  shipmentId: string;
  eventType: string;
  entityType: string;
  entityId: string;
  subject: string;
  body: string;
  audience: NotificationAudience;
  meta: RequestMeta;
}

interface Recipient {
  userId: string;
  email: string;
}

/**
 * Resolves recipients from tenant data, delegates delivery to the configured
 * provider, then appends the outcome to the outbox. Nothing is ever updated or
 * deleted, and no address is hardcoded.
 */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
    @Inject(NOTIFICATION_PROVIDER_TOKEN) private readonly provider: NotificationProvider,
  ) {}

  async emit(input: EmitNotificationInput): Promise<void> {
    const recipients = await this.recipients(input);

    const outcomes: Array<Recipient & DeliveryResult> = await Promise.all(
      recipients.map(async (recipient) => ({
        ...recipient,
        ...(await this.provider.send({
          to: recipient.email,
          subject: input.subject,
          body: input.body,
        })),
      })),
    );

    await this.db.withTenant(input.tenantId, async (trx) => {
      for (const outcome of outcomes) {
        await trx
          .insertInto('notification_outbox')
          .values({
            id: uuidv7(),
            tenant_id: input.tenantId,
            event_type: input.eventType,
            entity_type: input.entityType,
            entity_id: input.entityId,
            recipient_user_id: outcome.userId,
            recipient_email: outcome.email,
            channel: this.provider.channel,
            subject: input.subject,
            body: input.body,
            status: outcome.status,
            detail: outcome.detail ?? null,
          })
          .execute();
      }

      const counts: Record<string, number> = {};
      for (const outcome of outcomes) {
        counts[outcome.status] = (counts[outcome.status] ?? 0) + 1;
      }
      await this.audit.recordInTransaction(trx, {
        tenantId: input.tenantId,
        action: 'notification.emitted',
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: {
          eventType: input.eventType,
          channel: this.provider.channel,
          recipientCount: outcomes.length,
          counts,
        },
        ip: input.meta.ip,
        userAgent: input.meta.userAgent,
      });
    });
  }

  private async recipients(input: EmitNotificationInput): Promise<Recipient[]> {
    return this.db.withTenant(input.tenantId, async (trx) => {
      const found = new Map<string, Recipient>();

      if (input.audience === 'agency' || input.audience === 'both') {
        const agency = await trx
          .selectFrom('users')
          .select(['id', 'email'])
          .where('role', 'in', ['agency_owner', 'agent_staff'])
          .execute();
        for (const user of agency) {
          found.set(user.id, { userId: user.id, email: user.email });
        }
      }

      if (input.audience === 'importer' || input.audience === 'both') {
        const shipment = await trx
          .selectFrom('shipments')
          .select('importer_user_id')
          .where('id', '=', input.shipmentId)
          .executeTakeFirst();
        if (shipment?.importer_user_id) {
          const importer = await trx
            .selectFrom('users')
            .select(['id', 'email'])
            .where('id', '=', shipment.importer_user_id)
            .executeTakeFirst();
          if (importer) {
            found.set(importer.id, { userId: importer.id, email: importer.email });
          }
        }
      }

      return [...found.values()];
    });
  }
}

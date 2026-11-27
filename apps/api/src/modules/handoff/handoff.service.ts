import { Injectable } from '@nestjs/common';
import { ApiError } from '../../common/errors/api-error';
import { DatabaseService } from '../../database/database.service';
import { AuditService } from '../audit/audit.service';
import type { RequestMeta } from '../auth/auth.service';
import type { HandoffExport } from './handoff.dto';

const SHIPMENT_COLUMNS = [
  'id',
  'reference',
  'client_name',
  'client_contact',
  'type',
  'stage',
  'hold_reason',
  'origin',
  'destination',
  'consignment',
] as const;

const EVENT_COLUMNS = ['from_stage', 'to_stage', 'note', 'source', 'created_at'] as const;

const INVOICE_COLUMNS = [
  'id',
  'number',
  'currency',
  'status',
  'total_minor',
  'vat_rate_bp',
  'vat_verification_status',
] as const;

const INVOICE_LINE_COLUMNS = [
  'charge_type_code',
  'description',
  'quantity',
  'line_amount_minor',
  'tax_minor',
  'sort_order',
] as const;

/**
 * Produces a stable, read-only artifact for an agent to key into ASYCUDA World.
 * There is deliberately no outbound call: the handoff is one-way and stays
 * inside the agent's control.
 */
@Injectable()
export class HandoffService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  async create(
    tenantId: string,
    actorUserId: string,
    shipmentId: string,
    meta: RequestMeta,
  ): Promise<HandoffExport> {
    return this.db.withTenant(tenantId, async (trx) => {
      const shipment = await trx
        .selectFrom('shipments')
        .select(SHIPMENT_COLUMNS)
        .where('id', '=', shipmentId)
        .executeTakeFirst();
      if (!shipment) throw ApiError.notFound('Shipment not found');

      const eventRows = await trx
        .selectFrom('shipment_events')
        .select(EVENT_COLUMNS)
        .where('shipment_id', '=', shipmentId)
        .orderBy('created_at', 'asc')
        .execute();

      const invoiceRow = await trx
        .selectFrom('invoices')
        .select(INVOICE_COLUMNS)
        .where('shipment_id', '=', shipmentId)
        .where('status', '=', 'issued')
        .orderBy('issued_at', 'desc')
        .limit(1)
        .executeTakeFirst();

      let invoice: HandoffExport['invoice'] = null;
      if (invoiceRow) {
        const lineRows = await trx
          .selectFrom('invoice_lines')
          .select(INVOICE_LINE_COLUMNS)
          .where('invoice_id', '=', invoiceRow.id)
          .orderBy('sort_order', 'asc')
          .execute();
        invoice = {
          number: invoiceRow.number,
          currency: invoiceRow.currency,
          status: invoiceRow.status,
          totalMinor: invoiceRow.total_minor,
          vatRateBp: invoiceRow.vat_rate_bp,
          vatVerificationStatus: invoiceRow.vat_verification_status,
          lines: lineRows.map((line) => ({
            chargeType: line.charge_type_code,
            description: line.description,
            quantity: line.quantity,
            lineAmountMinor: line.line_amount_minor,
            taxMinor: line.tax_minor,
          })),
        };
      }

      const artifact: HandoffExport = {
        schemaVersion: 'zclear.handoff.v1',
        generatedAt: new Date().toISOString(),
        shipment: {
          id: shipment.id,
          reference: shipment.reference,
          clientName: shipment.client_name,
          clientContact: shipment.client_contact,
          type: shipment.type,
          stage: shipment.stage,
          holdReason: shipment.hold_reason,
          origin: shipment.origin,
          destination: shipment.destination,
          consignment: shipment.consignment,
        },
        events: eventRows.map((event) => ({
          fromStage: event.from_stage,
          toStage: event.to_stage,
          note: event.note,
          source: event.source,
          createdAt: event.created_at.toISOString(),
        })),
        invoice,
        notes: [
          'One-way handoff only: customs declaration, duty assessment and release happen in ASYCUDA World.',
          'Z Clear does not infer duty, tax or fee amounts; figures come from entered invoice lines.',
        ],
      };

      await this.audit.recordInTransaction(trx, {
        tenantId,
        actorUserId,
        action: 'handoff.export_created',
        entityType: 'shipment',
        entityId: shipmentId,
        metadata: {
          schemaVersion: artifact.schemaVersion,
          invoiceIncluded: invoice !== null,
          eventCount: artifact.events.length,
        },
        ip: meta.ip,
        userAgent: meta.userAgent,
      });

      return artifact;
    });
  }
}

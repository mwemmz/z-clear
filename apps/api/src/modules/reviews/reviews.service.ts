import { Injectable } from '@nestjs/common';
import type { Transaction } from 'kysely';
import {
  REVIEW_POINT_EVENTS,
  REVIEW_TRANSITIONS,
  checkDraft,
  hasBlockingFinding,
  type DraftFinding,
  type ImporterReviewAction,
  type ImporterReviewState,
} from '@zclear/shared';
import { ApiError } from '../../common/errors/api-error';
import { uuidv7 } from '../../common/ids';
import type { Role } from '../../common/roles';
import { DatabaseService } from '../../database/database.service';
import type { Database } from '../../database/database.types';
import { AuditService } from '../audit/audit.service';
import type { RequestMeta } from '../auth/auth.service';
import { WordingService } from './wording.service';
import type {
  ImporterReviewSummary,
  ListReviewsQuery,
  ReviewFindingSummary,
  ReviewActionInput,
} from './reviews.dto';

/**
 * A review row joined with the shipment's live freshness counter, so every
 * read path can tell whether the revision was raised against stale data.
 */
const REVIEW_COLUMNS = [
  'r.id',
  'r.tenant_id',
  'r.shipment_id',
  'r.revision',
  'r.parent_review_id',
  'r.state',
  'r.message',
  'r.query',
  'r.sent_at',
  'r.queried_at',
  'r.approved_at',
  'r.sent_by',
  'r.approved_by',
  'r.shipment_reference',
  'r.client_name',
  'r.client_contact',
  'r.shipment_type',
  'r.origin',
  'r.destination',
  'r.consignment',
  'r.baseline_freshness',
  'r.draft_findings',
  'r.draft_blocked',
  'r.wording',
  'r.wording_source',
  'r.created_at',
  'r.updated_at',
  's.review_freshness as shipment_freshness',
] as const;

interface ReviewRow {
  id: string;
  tenant_id: string;
  shipment_id: string;
  revision: number;
  parent_review_id: string | null;
  state: ImporterReviewState;
  message: string | null;
  query: string | null;
  sent_at: Date | null;
  queried_at: Date | null;
  approved_at: Date | null;
  sent_by: string | null;
  approved_by: string | null;
  shipment_reference: string;
  client_name: string;
  client_contact: string | null;
  shipment_type: 'import' | 'export' | 'transit';
  origin: string | null;
  destination: string | null;
  consignment: Record<string, unknown>;
  baseline_freshness: number;
  draft_findings: unknown;
  draft_blocked: boolean;
  wording: string | null;
  wording_source: 'fixed' | 'ai';
  created_at: Date;
  updated_at: Date;
  /** Live counter from the joined shipment row. */
  shipment_freshness: number;
}

export interface ViewerContext {
  role: Role;
  userId: string;
}

type ShipmentSnapshot = Pick<
  ReviewRow,
  'shipment_reference' | 'client_name' | 'client_contact' | 'shipment_type' | 'origin' | 'destination' | 'consignment'
>;

@Injectable()
export class ReviewsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
    private readonly wording: WordingService,
  ) {}

  /**
   * Lists review revisions, newest first. A `client_viewer` only ever sees
   * reviews of shipments assigned to them as the importer — enforced here,
   * not in the UI.
   */
  async list(tenantId: string, viewer: ViewerContext, query: ListReviewsQuery) {
    return this.db.withTenant(tenantId, async (trx) => {
      let builder = trx
        .selectFrom('importer_reviews as r')
        .innerJoin('shipments as s', 's.id', 'r.shipment_id')
        .select(REVIEW_COLUMNS);
      if (viewer.role === 'client_viewer') {
        builder = builder.where('s.importer_user_id', '=', viewer.userId);
      }
      if (query.shipmentId) builder = builder.where('r.shipment_id', '=', query.shipmentId);
      if (query.state) builder = builder.where('r.state', '=', query.state);
      const rows = await builder
        .orderBy('r.created_at', 'desc')
        .limit(query.limit)
        .offset(query.offset)
        .execute();
      return rows.map((row) => this.toSummary(row as ReviewRow));
    });
  }

  /** Fetches one revision, enforcing the same viewer assignment filter. */
  /** Fetches one revision, enforcing the same viewer assignment filter. */
  async get(tenantId: string, viewer: ViewerContext, id: string): Promise<ImporterReviewSummary> {
    return this.db.withTenant(tenantId, async (trx) => {
      const row = await this.findRow(trx, id);
      if (viewer.role === 'client_viewer') {
        const assigned = await trx
          .selectFrom('shipments')
          .select('id')
          .where('id', '=', row.shipment_id)
          .where('importer_user_id', '=', viewer.userId)
          .executeTakeFirst();
        if (!assigned) throw ApiError.notFound('Review not found');
      }
      return this.toSummary(row);
    });
  }

  /**
   * Sends the shipment details to the importer. Creates revision 1 when no
   * revision exists, refreshes an existing draft revision's snapshot,
   * recomputes the deterministic draft check and — when it passes — moves the
   * revision to `in_review` and records the agent's `review_sent` points. A
   * blocked draft stays a draft: nothing was sent, so no points are earned.
   */
  async send(
    tenantId: string,
    actorUserId: string,
    shipmentId: string,
    input: Pick<ReviewActionInput, 'message'>,
    meta: RequestMeta,
  ): Promise<ImporterReviewSummary> {
    if (!input.message) throw ApiError.validation('A message is required to send a review');
    const message: string = input.message;
    return this.db.withTenant(tenantId, async (trx) => {
      const shipment = await this.findShipment(trx, shipmentId);
      if (!shipment.importer_user_id) {
        throw ApiError.conflict('Assign an importer to the shipment before sending a review');
      }
      const importer = await trx
        .selectFrom('users')
        .select(['id', 'tpin'])
        .where('id', '=', shipment.importer_user_id)
        .executeTakeFirst();
      if (!importer) {
        throw ApiError.conflict('The assigned importer user no longer exists');
      }

      const latestRow = await this.latestRow(trx, shipmentId);
      if (latestRow && latestRow.state !== 'draft') {
        throw ApiError.conflict(
          'A review is already in flight; query it or revise it instead of sending again',
        );
      }

      const snapshot: ShipmentSnapshot = {
        shipment_reference: shipment.reference,
        client_name: shipment.client_name,
        client_contact: shipment.client_contact,
        shipment_type: shipment.type,
        origin: shipment.origin,
        destination: shipment.destination,
        consignment: shipment.consignment ?? {},
      };
      const findings = this.draftCheck(snapshot, importer.tpin);
      const blocked = hasBlockingFinding(findings);
      const composed = blocked ? null : this.wording.compose(snapshot, message);

      let row: ReviewRow;
      if (latestRow) {
        await trx
          .updateTable('importer_reviews')
          .set({
            message,
            ...snapshot,
            baseline_freshness: shipment.review_freshness,
            draft_findings: findings,
            draft_blocked: blocked,
            wording: composed?.text ?? null,
            wording_source: composed?.source ?? 'fixed',
            sent_at: blocked ? null : new Date(),
            state: blocked ? 'draft' : 'in_review',
            sent_by: blocked ? null : actorUserId,
            updated_at: new Date(),
          })
          .where('id', '=', latestRow.id)
          .execute();
        row = await this.reloadRow(trx, latestRow.id);
      } else {
        const id = uuidv7();
        await trx
          .insertInto('importer_reviews')
          .values({
            id,
            tenant_id: tenantId,
            shipment_id: shipmentId,
            revision: 1,
            message,
            ...snapshot,
            baseline_freshness: shipment.review_freshness,
            draft_findings: findings,
            draft_blocked: blocked,
            wording: composed?.text ?? null,
            wording_source: composed?.source ?? 'fixed',
            sent_at: blocked ? null : new Date(),
            state: blocked ? 'draft' : 'in_review',
            sent_by: blocked ? null : actorUserId,
            created_by: actorUserId,
          })
          .execute();
        row = await this.reloadRow(trx, id);
      }

      if (blocked) {
        await this.audit.recordInTransaction(trx, {
          tenantId,
          actorUserId,
          action: 'review.send_blocked',
          entityType: 'importer_review',
          entityId: row.id,
          metadata: { shipmentId, revision: row.revision, findings: findings.map((f) => f.code) },
          ip: meta.ip,
          userAgent: meta.userAgent,
        });
        return this.toSummary(row);
      }

      await this.recordPoints(trx, tenantId, actorUserId, shipmentId, row.id, 'review_sent');

      await this.audit.recordInTransaction(trx, {
        tenantId,
        actorUserId,
        action: 'review.sent',
        entityType: 'importer_review',
        entityId: row.id,
        metadata: { shipmentId, revision: row.revision },
        ip: meta.ip,
        userAgent: meta.userAgent,
      });

      return this.toSummary(row);
    });
  }

  /** Importer (or staff on their behalf) asks a question about the revision. */
  async query(
    tenantId: string,
    viewer: ViewerContext,
    actorUserId: string,
    id: string,
    input: Pick<ReviewActionInput, 'message'>,
    meta: RequestMeta,
  ): Promise<ImporterReviewSummary> {
    if (!input.message) throw ApiError.validation('A question is required to query a review');
    return this.db.withTenant(tenantId, async (trx) => {
      let row = await this.findRow(trx, id);
      if (viewer.role === 'client_viewer') {
        const assigned = await trx
          .selectFrom('shipments')
          .select('id')
          .where('id', '=', row.shipment_id)
          .where('importer_user_id', '=', viewer.userId)
          .executeTakeFirst();
        if (!assigned) throw ApiError.notFound('Review not found');
      }
      this.assertTransition(row, 'query');

      await trx
        .updateTable('importer_reviews')
        .set({
          state: 'queried',
          query: input.message,
          queried_at: new Date(),
          updated_at: new Date(),
        })
        .where('id', '=', row.id)
        .execute();

      await this.audit.recordInTransaction(trx, {
        tenantId,
        actorUserId,
        action: 'review.queried',
        entityType: 'importer_review',
        entityId: row.id,
        metadata: { shipmentId: row.shipment_id, revision: row.revision },
        ip: meta.ip,
        userAgent: meta.userAgent,
      });

      row = await this.reloadRow(trx, row.id);
      return this.toSummary(row);
    });
  }

  /**
   * Records a correction: closes the current revision and opens a fresh draft
   * revision carrying the corrected message, a fresh snapshot and a fresh
   * baseline. Only the latest revision can ever be approved, so approval
   * always binds to the exact corrected revision.
   */
  async revise(
    tenantId: string,
    actorUserId: string,
    id: string,
    input: Pick<ReviewActionInput, 'newMessage'>,
    meta: RequestMeta,
  ): Promise<ImporterReviewSummary> {
    if (!input.newMessage) {
      throw ApiError.validation('A corrected message is required to revise a review');
    }
    return this.db.withTenant(tenantId, async (trx) => {
      const row = await this.findRow(trx, id);
      this.assertTransition(row, 'revise');
      const shipment = await this.findShipment(trx, row.shipment_id);
      const importerTpin = shipment.importer_user_id
        ? (
            await trx
              .selectFrom('users')
              .select('tpin')
              .where('id', '=', shipment.importer_user_id)
              .executeTakeFirst()
          )?.tpin ?? null
        : null;

      const snapshot: ShipmentSnapshot = {
        shipment_reference: shipment.reference,
        client_name: shipment.client_name,
        client_contact: shipment.client_contact,
        shipment_type: shipment.type,
        origin: shipment.origin,
        destination: shipment.destination,
        consignment: shipment.consignment ?? {},
      };
      const findings = this.draftCheck(snapshot, importerTpin);

      // From in_review the correction supersedes the question flow; from
      // queried it simply closes the queried revision.
      await trx
        .updateTable('importer_reviews')
        .set({
          state: row.state === 'in_review' ? 'queried' : row.state,
          updated_at: new Date(),
        })
        .where('id', '=', row.id)
        .execute();

      const newId = uuidv7();
      await trx
        .insertInto('importer_reviews')
        .values({
          id: newId,
          tenant_id: tenantId,
          shipment_id: row.shipment_id,
          revision: row.revision + 1,
          parent_review_id: row.id,
          message: input.newMessage,
          ...snapshot,
          baseline_freshness: shipment.review_freshness,
          draft_findings: findings,
          draft_blocked: hasBlockingFinding(findings),
          wording: null,
          wording_source: 'fixed',
          state: 'draft',
          created_by: actorUserId,
        })
        .execute();

      await this.audit.recordInTransaction(trx, {
        tenantId,
        actorUserId,
        action: 'review.revised',
        entityType: 'importer_review',
        entityId: newId,
        metadata: {
          shipmentId: row.shipment_id,
          fromRevision: row.revision,
          toRevision: row.revision + 1,
        },
        ip: meta.ip,
        userAgent: meta.userAgent,
      });

      const created = await this.reloadRow(trx, newId);
      return this.toSummary(created);
    });
  }

  /**
   * Approves the exact revision addressed by the call. Three distinct
   * failures: the revision was superseded (someone revised since), the
   * revision is not in a state that can be approved, or the shipment was
   * materially edited after the revision was raised (freshness mismatch), so
   * a fresh review is required first.
   */
  async approve(
    tenantId: string,
    actorUserId: string,
    id: string,
    meta: RequestMeta,
  ): Promise<ImporterReviewSummary> {
    return this.db.withTenant(tenantId, async (trx) => {
      const row = await this.findRow(trx, id);
      this.assertTransition(row, 'approve');
      if (row.baseline_freshness !== row.shipment_freshness) {
        throw ApiError.conflict(
          'The shipment changed after this review was raised; revise the review before approving',
        );
      }

      await trx
        .updateTable('importer_reviews')
        .set({
          state: 'approved',
          approved_at: new Date(),
          approved_by: actorUserId,
          updated_at: new Date(),
        })
        .where('id', '=', row.id)
        .execute();

      await this.recordPoints(
        trx,
        tenantId,
        actorUserId,
        row.shipment_id,
        row.id,
        'review_approved',
      );

      await this.audit.recordInTransaction(trx, {
        tenantId,
        actorUserId,
        action: 'review.approved',
        entityType: 'importer_review',
        entityId: row.id,
        metadata: { shipmentId: row.shipment_id, revision: row.revision },
        ip: meta.ip,
        userAgent: meta.userAgent,
      });

      const approved = await this.reloadRow(trx, row.id);
      return this.toSummary(approved);
    });
  }

  // ----- internals -----

  private assertTransition(row: ReviewRow, action: 'send' | 'query' | 'revise' | 'approve'): void {
    if (!REVIEW_TRANSITIONS[row.state].includes(action)) {
      throw ApiError.conflict(
        `A ${row.state.replace('_', ' ')} review cannot be ${
          action === 'query' ? 'queried' : action === 'revise' ? 'revised' : `${action}ed`
        }`,
      );
    }
  }

  /** Deterministic per-revision draft check (pure shared helper). */
  private draftCheck(snapshot: ShipmentSnapshot, importerTpin: string | null): DraftFinding[] {
    return checkDraft({
      reference: snapshot.shipment_reference,
      clientName: snapshot.client_name,
      clientContact: snapshot.client_contact,
      type: snapshot.shipment_type,
      origin: snapshot.origin,
      destination: snapshot.destination,
      consignment: snapshot.consignment,
      importerTpin,
    });
  }

  private async findRow(trx: Transaction<Database>, id: string): Promise<ReviewRow> {
    const row = await trx
      .selectFrom('importer_reviews as r')
      .innerJoin('shipments as s', 's.id', 'r.shipment_id')
      .select(REVIEW_COLUMNS)
      .where('r.id', '=', id)
      .executeTakeFirst();
    if (!row) throw ApiError.notFound('Review not found');
    return row as ReviewRow;
  }

  private async reloadRow(trx: Transaction<Database>, id: string): Promise<ReviewRow> {
    return this.findRow(trx, id);
  }

  private async latestRow(trx: Transaction<Database>, shipmentId: string): Promise<ReviewRow | null> {
    const row = await trx
      .selectFrom('importer_reviews as r')
      .innerJoin('shipments as s', 's.id', 'r.shipment_id')
      .select(REVIEW_COLUMNS)
      .where('r.shipment_id', '=', shipmentId)
      .orderBy('r.revision', 'desc')
      .executeTakeFirst();
    return (row as ReviewRow) ?? null;
  }

  private async findShipment(trx: Transaction<Database>, shipmentId: string) {
    const shipment = await trx
      .selectFrom('shipments')
      .select([
        'id',
        'reference',
        'client_name',
        'client_contact',
        'type',
        'origin',
        'destination',
        'consignment',
        'importer_user_id',
        'review_freshness',
      ])
      .where('id', '=', shipmentId)
      .executeTakeFirst();
    if (!shipment) throw ApiError.notFound('Shipment not found');
    return shipment;
  }

  /**
   * Appends the points ledger entry for a qualifying event. The unique index
   * on (tenant_id, review_id, event) means one entry per event per review; a
   * conflict is ignored, so a retried transaction can never double-pay.
   */
  private async recordPoints(
    trx: Transaction<Database>,
    tenantId: string,
    userId: string,
    shipmentId: string,
    reviewId: string,
    event: keyof typeof REVIEW_POINT_EVENTS,
  ): Promise<void> {
    await trx
      .insertInto('review_points')
      .values({
        id: uuidv7(),
        tenant_id: tenantId,
        user_id: userId,
        shipment_id: shipmentId,
        review_id: reviewId,
        event,
        points: REVIEW_POINT_EVENTS[event],
      })
      .onConflict((oc) => oc.columns(['tenant_id', 'review_id', 'event']).doNothing())
      .execute();
  }

  private toSummary(row: ReviewRow): ImporterReviewSummary {
    const stale = row.baseline_freshness !== row.shipment_freshness;
    return {
      id: row.id,
      shipmentId: row.shipment_id,
      revision: row.revision,
      parentReviewId: row.parent_review_id,
      state: row.state,
      message: row.message,
      query: row.query,
      wording: row.wording,
      wordingSource: row.wording_source,
      sentAt: row.sent_at?.toISOString() ?? null,
      queriedAt: row.queried_at?.toISOString() ?? null,
      approvedAt: row.approved_at?.toISOString() ?? null,
      isStale: stale,
      allowedActions: this.allowedActionsFor(row.state, stale),
      draftFindings: this.findingsOf(row),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  /** Actions legal right now, minus approve when the baseline went stale. */
  private allowedActionsFor(state: ImporterReviewState, stale: boolean): ImporterReviewAction[] {
    const actions = [...REVIEW_TRANSITIONS[state]];
    if (stale) {
      const index = actions.indexOf('approve');
      if (index >= 0) actions.splice(index, 1);
    }
    return actions;
  }

  private findingsOf(row: ReviewRow): ReviewFindingSummary[] {
    const raw = row.draft_findings;
    if (!Array.isArray(raw)) return [];
    return raw
      .filter(
        (item): item is DraftFinding =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as DraftFinding).code === 'string' &&
          typeof (item as DraftFinding).message === 'string',
      )
      .map((item) => ({
        code: item.code,
        field: item.field ?? null,
        message: item.message,
        severity: item.severity === 'error' ? 'error' : 'warning',
      }));
  }
}

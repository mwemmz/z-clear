import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { ApiError } from '../../common/errors/api-error';
import { uuidv7 } from '../../common/ids';
import { APP_ENV } from '../../config/config.module';
import { allowedUploadTypes, type AppEnv } from '../../config/env';
import { DatabaseService } from '../../database/database.service';
import { SCAN_PROVIDER, type ScanProvider } from '../../storage/scan.provider';
import {
  STORAGE_PROVIDER,
  type StorageProvider,
  type StoredObject,
} from '../../storage/storage.types';
import { AuditService } from '../audit/audit.service';
import type { RequestMeta } from '../auth/auth.service';
import type {
  CreateDocumentInput,
  DocumentFileSummary,
  DocumentStatus,
  DocumentSummary,
  ShipmentDocumentsView,
  UpdateDocumentInput,
  UploadedFile,
} from './documents.dto';

const UNIQUE_VIOLATION = '23505';
const BLOCKED_SCAN_STATUSES = ['pending', 'infected', 'failed'];

export interface OpenedFile {
  fileName: string;
  contentType: string;
  url: string | null;
  object: StoredObject | null;
}

@Injectable()
export class DocumentsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
    @Inject(SCAN_PROVIDER) private readonly scanner: ScanProvider,
    @Inject(APP_ENV) private readonly env: AppEnv,
  ) {}

  async listForShipment(tenantId: string, shipmentId: string): Promise<ShipmentDocumentsView> {
    return this.db.withTenant(tenantId, async (trx) => {
      const shipment = await trx
        .selectFrom('shipments')
        .select(['id', 'type'])
        .where('id', '=', shipmentId)
        .executeTakeFirst();
      if (!shipment) throw ApiError.notFound('Shipment not found');

      const documentRows = await trx
        .selectFrom('documents')
        .select([
          'id',
          'shipment_id',
          'doc_type',
          'label',
          'status',
          'notes',
          'created_at',
          'updated_at',
        ])
        .where('shipment_id', '=', shipmentId)
        .orderBy('created_at', 'asc')
        .execute();

      const fileRows = await trx
        .selectFrom('files')
        .select([
          'id',
          'document_id',
          'original_name',
          'content_type',
          'size_bytes',
          'scan_status',
          'created_at',
        ])
        .where('shipment_id', '=', shipmentId)
        .orderBy('created_at', 'asc')
        .execute();

      const requirementRows = await trx
        .selectFrom('document_requirements')
        .select(['doc_type', 'label', 'is_mandatory', 'sort_order'])
        .where('shipment_type', '=', shipment.type)
        .where('is_active', '=', true)
        .orderBy('sort_order', 'asc')
        .execute();

      const filesByDocument = new Map<string, DocumentFileSummary[]>();
      for (const file of fileRows) {
        const list = filesByDocument.get(file.document_id) ?? [];
        list.push(toFileSummary(file));
        filesByDocument.set(file.document_id, list);
      }

      const documents = documentRows.map((row) =>
        toSummary(row, filesByDocument.get(row.id) ?? []),
      );

      const satisfied = new Set(
        documents.filter((doc) => doc.status !== 'rejected').map((doc) => doc.docType),
      );
      const requirements = requirementRows.map((row) => ({
        docType: row.doc_type,
        label: row.label,
        isMandatory: row.is_mandatory,
        sortOrder: row.sort_order,
        satisfied: satisfied.has(row.doc_type),
      }));
      const missing = requirements
        .filter((requirement) => requirement.isMandatory && !requirement.satisfied)
        .map((requirement) => requirement.docType);

      return { shipmentId, documents, requirements, missing };
    });
  }

  async create(
    tenantId: string,
    actorUserId: string,
    shipmentId: string,
    input: CreateDocumentInput,
    meta: RequestMeta,
  ): Promise<DocumentSummary> {
    try {
      return await this.db.withTenant(tenantId, async (trx) => {
        const shipment = await trx
          .selectFrom('shipments')
          .select('id')
          .where('id', '=', shipmentId)
          .executeTakeFirst();
        if (!shipment) throw ApiError.notFound('Shipment not found');

        const row = await trx
          .insertInto('documents')
          .values({
            id: uuidv7(),
            tenant_id: tenantId,
            shipment_id: shipmentId,
            doc_type: input.docType,
            label: input.label,
            notes: input.notes ?? null,
            created_by: actorUserId,
            updated_by: actorUserId,
          })
          .returning([
            'id',
            'shipment_id',
            'doc_type',
            'label',
            'status',
            'notes',
            'created_at',
            'updated_at',
          ])
          .executeTakeFirstOrThrow();

        await this.audit.recordInTransaction(trx, {
          tenantId,
          actorUserId,
          action: 'document.created',
          entityType: 'document',
          entityId: row.id,
          metadata: { docType: input.docType, shipmentId },
          ip: meta.ip,
          userAgent: meta.userAgent,
        });

        return toSummary(row, []);
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw ApiError.conflict('That document type already exists on this shipment');
      }
      throw error;
    }
  }

  async update(
    tenantId: string,
    actorUserId: string,
    documentId: string,
    input: UpdateDocumentInput,
    meta: RequestMeta,
  ): Promise<DocumentSummary> {
    return this.db.withTenant(tenantId, async (trx) => {
      const row = await trx
        .updateTable('documents')
        .set({
          ...(input.label !== undefined ? { label: input.label } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          updated_by: actorUserId,
          updated_at: new Date(),
        })
        .where('id', '=', documentId)
        .returning([
          'id',
          'shipment_id',
          'doc_type',
          'label',
          'status',
          'notes',
          'created_at',
          'updated_at',
        ])
        .executeTakeFirst();
      if (!row) throw ApiError.notFound('Document not found');

      await this.audit.recordInTransaction(trx, {
        tenantId,
        actorUserId,
        action: 'document.updated',
        entityType: 'document',
        entityId: documentId,
        metadata: { fields: Object.keys(input) },
        ip: meta.ip,
        userAgent: meta.userAgent,
      });

      const fileRows = await trx
        .selectFrom('files')
        .select(['id', 'original_name', 'content_type', 'size_bytes', 'scan_status', 'created_at'])
        .where('document_id', '=', documentId)
        .orderBy('created_at', 'asc')
        .execute();

      return toSummary(row, fileRows.map(toFileSummary));
    });
  }

  async remove(
    tenantId: string,
    actorUserId: string,
    documentId: string,
    meta: RequestMeta,
  ): Promise<{ ok: true }> {
    const keys = await this.db.withTenant(tenantId, async (trx) => {
      const document = await trx
        .selectFrom('documents')
        .select('id')
        .where('id', '=', documentId)
        .executeTakeFirst();
      if (!document) throw ApiError.notFound('Document not found');

      const fileRows = await trx
        .selectFrom('files')
        .select('storage_key')
        .where('document_id', '=', documentId)
        .execute();

      await trx.deleteFrom('documents').where('id', '=', documentId).execute();

      await this.audit.recordInTransaction(trx, {
        tenantId,
        actorUserId,
        action: 'document.deleted',
        entityType: 'document',
        entityId: documentId,
        metadata: { files: fileRows.length },
        ip: meta.ip,
        userAgent: meta.userAgent,
      });

      return fileRows.map((file) => file.storage_key);
    });

    // Storage cleanup is best-effort after the DB commit; a leftover object is
    // unreachable (no row references it) and is swept by a future retention job.
    for (const key of keys) {
      try {
        await this.storage.remove(key);
      } catch {
        // ignore
      }
    }
    return { ok: true };
  }

  async addFile(
    tenantId: string,
    actorUserId: string,
    documentId: string,
    file: UploadedFile | undefined,
    meta: RequestMeta,
  ): Promise<DocumentFileSummary> {
    if (!file) {
      throw ApiError.validation('A file is required', [{ field: 'file', issue: 'required' }]);
    }
    if (file.size > this.env.MAX_UPLOAD_BYTES) {
      throw ApiError.payloadTooLarge(
        `File exceeds the maximum size of ${this.env.MAX_UPLOAD_BYTES} bytes`,
      );
    }
    const allowed = allowedUploadTypes(this.env);
    const contentType = file.mimetype?.toLowerCase() ?? '';
    if (!allowed.includes(contentType)) {
      throw ApiError.validation('File type is not allowed', [
        { field: 'file', issue: `content type ${contentType || '(unknown)'} is not allowed` },
      ]);
    }

    const document = await this.db.withTenant(tenantId, (trx) =>
      trx
        .selectFrom('documents')
        .select(['id', 'shipment_id'])
        .where('id', '=', documentId)
        .executeTakeFirst(),
    );
    if (!document) throw ApiError.notFound('Document not found');

    const fileId = uuidv7();
    const storageKey = `${tenantId}/${document.shipment_id}/${fileId}`;
    const checksum = createHash('sha256').update(file.buffer).digest('hex');

    await this.storage.put(storageKey, file.buffer, contentType);

    const scan = await this.scanner.scan({
      body: file.buffer,
      contentType,
      fileName: file.originalname,
    });
    if (scan.status === 'infected') {
      await this.storage.remove(storageKey);
      throw ApiError.conflict('File was rejected by the malware scanner');
    }

    try {
      return await this.db.withTenant(tenantId, async (trx) => {
        const row = await trx
          .insertInto('files')
          .values({
            id: fileId,
            tenant_id: tenantId,
            shipment_id: document.shipment_id,
            document_id: documentId,
            storage_key: storageKey,
            original_name: sanitizeFileName(file.originalname),
            content_type: contentType,
            size_bytes: file.size,
            checksum_sha256: checksum,
            scan_status: scan.status,
            uploaded_by: actorUserId,
          })
          .returning([
            'id',
            'original_name',
            'content_type',
            'size_bytes',
            'scan_status',
            'created_at',
          ])
          .executeTakeFirstOrThrow();

        await trx
          .updateTable('documents')
          .set({ status: 'uploaded', updated_by: actorUserId, updated_at: new Date() })
          .where('id', '=', documentId)
          .where('status', '=', 'pending')
          .execute();

        await this.audit.recordInTransaction(trx, {
          tenantId,
          actorUserId,
          action: 'file.uploaded',
          entityType: 'file',
          entityId: fileId,
          metadata: { documentId, sizeBytes: file.size, contentType },
          ip: meta.ip,
          userAgent: meta.userAgent,
        });

        return toFileSummary(row);
      });
    } catch (error) {
      await this.storage.remove(storageKey);
      throw error;
    }
  }

  async openFile(tenantId: string, fileId: string): Promise<OpenedFile> {
    const row = await this.db.withTenant(tenantId, (trx) =>
      trx
        .selectFrom('files')
        .select(['storage_key', 'original_name', 'content_type', 'scan_status'])
        .where('id', '=', fileId)
        .executeTakeFirst(),
    );
    if (!row) throw ApiError.notFound('File not found');
    if (BLOCKED_SCAN_STATUSES.includes(row.scan_status)) {
      throw ApiError.forbidden('File is not available for download');
    }

    const url = await this.storage.signedDownloadUrl(
      row.storage_key,
      this.env.SIGNED_URL_TTL_SECONDS,
    );
    if (url) {
      return {
        fileName: row.original_name,
        contentType: row.content_type,
        url,
        object: null,
      };
    }

    const object = await this.storage.get(row.storage_key);
    return {
      fileName: row.original_name,
      contentType: row.content_type,
      url: null,
      object,
    };
  }
}

function toSummary(
  row: {
    id: string;
    shipment_id: string;
    doc_type: string;
    label: string;
    status: DocumentStatus;
    notes: string | null;
    created_at: Date;
    updated_at: Date;
  },
  files: DocumentFileSummary[],
): DocumentSummary {
  return {
    id: row.id,
    shipmentId: row.shipment_id,
    docType: row.doc_type,
    label: row.label,
    status: row.status,
    notes: row.notes,
    files,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function toFileSummary(row: {
  id: string;
  original_name: string;
  content_type: string;
  size_bytes: number;
  scan_status: string;
  created_at: Date;
}): DocumentFileSummary {
  return {
    id: row.id,
    originalName: row.original_name,
    contentType: row.content_type,
    sizeBytes: Number(row.size_bytes),
    scanStatus: row.scan_status,
    createdAt: row.created_at.toISOString(),
  };
}

/** Strip path components and header-breaking characters from an untrusted name. */
function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'file';
  const cleaned = base.replace(/[\r\n"\\]/g, '_').trim();
  return cleaned.length > 0 ? cleaned.slice(0, 200) : 'file';
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === UNIQUE_VIOLATION
  );
}

import { z } from 'zod';

export const DOCUMENT_STATUSES = ['pending', 'uploaded', 'verified', 'rejected'] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

const docType = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .regex(/^[a-z0-9_]+$/, 'docType must be lower_snake_case');
const label = z.string().trim().min(1).max(120);
const notes = z.string().trim().max(1000);

export const createDocumentSchema = z.object({ docType, label, notes: notes.optional() }).strict();

export const updateDocumentSchema = z
  .object({ label, status: z.enum(DOCUMENT_STATUSES), notes })
  .partial()
  .strict();

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;

/** The subset of a multer file this module relies on (avoids a global type dep). */
export interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface DocumentFileSummary {
  id: string;
  originalName: string;
  contentType: string;
  sizeBytes: number;
  scanStatus: string;
  createdAt: string;
}

export interface DocumentSummary {
  id: string;
  shipmentId: string;
  docType: string;
  label: string;
  status: DocumentStatus;
  notes: string | null;
  files: DocumentFileSummary[];
  createdAt: string;
  updatedAt: string;
}

export interface DocumentRequirementView {
  docType: string;
  label: string;
  isMandatory: boolean;
  sortOrder: number;
  satisfied: boolean;
}

export interface ShipmentDocumentsView {
  shipmentId: string;
  documents: DocumentSummary[];
  requirements: DocumentRequirementView[];
  /** Mandatory doc types with no document yet. */
  missing: string[];
}

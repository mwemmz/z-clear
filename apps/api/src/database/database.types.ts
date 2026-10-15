import type { ColumnType } from 'kysely';
import type { ShipmentStatus, ShipmentType } from '@zclear/shared';
import type { Role } from '../common/roles';

/** Column with a database default: optional on insert. */
export type Generated<T> = ColumnType<T, T | undefined, T>;
/** Nullable column: optional on insert. */
export type Nullable<T> = ColumnType<T | null, T | null | undefined, T | null>;
/** Timestamp column with a database default. */
export type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>;

export interface TenantsTable {
  id: string;
  name: string;
  is_active: Generated<boolean>;
  created_at: Timestamp;
  updated_at: Timestamp;
  created_by: Nullable<string>;
}

export interface UsersTable {
  id: string;
  tenant_id: string;
  email: string;
  password_hash: string;
  role: Role;
  is_active: Generated<boolean>;
  totp_secret: Nullable<string>;
  totp_enabled: Generated<boolean>;
  failed_login_attempts: Generated<number>;
  locked_until: Nullable<Date>;
  created_at: Timestamp;
  updated_at: Timestamp;
  created_by: Nullable<string>;
}

export interface RefreshTokensTable {
  id: string;
  tenant_id: string;
  user_id: string;
  token_hash: string;
  expires_at: Timestamp;
  revoked_at: Nullable<Date>;
  replaced_by: Nullable<string>;
  created_at: Timestamp;
}

export interface AuditLogsTable {
  id: string;
  tenant_id: Nullable<string>;
  actor_user_id: Nullable<string>;
  action: string;
  entity_type: Nullable<string>;
  entity_id: Nullable<string>;
  metadata: Generated<Record<string, unknown>>;
  ip: Nullable<string>;
  user_agent: Nullable<string>;
  created_at: Timestamp;
}

export interface ShipmentsTable {
  id: string;
  tenant_id: string;
  reference: string;
  client_name: string;
  client_contact: Nullable<string>;
  type: ShipmentType;
  stage: Generated<ShipmentStatus>;
  hold_reason: Nullable<string>;
  origin: Nullable<string>;
  destination: Nullable<string>;
  consignment: Generated<Record<string, unknown>>;
  is_active: Generated<boolean>;
  created_at: Timestamp;
  updated_at: Timestamp;
  created_by: Nullable<string>;
  updated_by: Nullable<string>;
}

export interface ShipmentEventsTable {
  id: string;
  tenant_id: string;
  shipment_id: string;
  from_stage: Nullable<ShipmentStatus>;
  to_stage: ShipmentStatus;
  note: Nullable<string>;
  source: Generated<'manual' | 'system'>;
  actor_user_id: Nullable<string>;
  created_at: Timestamp;
}

export interface TariffSchedulesTable {
  id: string;
  code: string;
  name: string;
  currency: Generated<string>;
  effective_from: Nullable<Date>;
  effective_to: Nullable<Date>;
  verification_status: Generated<'NEEDS_VERIFICATION' | 'VERIFIED' | 'SUPERSEDED'>;
  source_note: Nullable<string>;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface TariffLinesTable {
  id: string;
  schedule_id: string;
  hs_code: string;
  description: string;
  duty_rate_bp: Nullable<number>;
  vat_rate_bp: Nullable<number>;
  unit: Nullable<string>;
  notes: Nullable<string>;
  verification_status: Generated<'NEEDS_VERIFICATION' | 'VERIFIED' | 'SUPERSEDED'>;
  created_at: Timestamp;
}

export type DocumentStatus = 'pending' | 'uploaded' | 'verified' | 'rejected';
export type FileScanStatus = 'pending' | 'clean' | 'infected' | 'failed' | 'skipped';

export interface DocumentsTable {
  id: string;
  tenant_id: string;
  shipment_id: string;
  doc_type: string;
  label: string;
  status: Generated<DocumentStatus>;
  notes: Nullable<string>;
  created_at: Timestamp;
  updated_at: Timestamp;
  created_by: Nullable<string>;
  updated_by: Nullable<string>;
}

export interface FilesTable {
  id: string;
  tenant_id: string;
  shipment_id: string;
  document_id: string;
  storage_key: string;
  original_name: string;
  content_type: string;
  size_bytes: number;
  checksum_sha256: string;
  scan_status: Generated<FileScanStatus>;
  uploaded_by: Nullable<string>;
  created_at: Timestamp;
}

export interface DocumentRequirementsTable {
  id: string;
  tenant_id: string;
  shipment_type: ShipmentType;
  doc_type: string;
  label: string;
  is_mandatory: Generated<boolean>;
  sort_order: Generated<number>;
  is_active: Generated<boolean>;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface ChargeTypesTable {
  code: string;
  label: string;
  is_service_fee: Generated<boolean>;
  is_selectable: Generated<boolean>;
  sort_order: Generated<number>;
  is_active: Generated<boolean>;
  created_at: Timestamp;
}

export interface TaxRatesTable {
  id: string;
  code: string;
  label: string;
  rate_bp: number;
  applies_to: Generated<string>;
  currency: Nullable<string>;
  effective_from: Nullable<Date>;
  effective_to: Nullable<Date>;
  verification_status: Generated<'NEEDS_VERIFICATION' | 'VERIFIED' | 'SUPERSEDED'>;
  source_note: Nullable<string>;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'declined' | 'expired';
export type InvoiceStatus = 'draft' | 'issued' | 'partially_paid' | 'paid' | 'void';
export type PaymentMethod = 'cash' | 'bank_transfer' | 'mobile_money' | 'card' | 'other';
export type VerificationStatus = 'NEEDS_VERIFICATION' | 'VERIFIED' | 'SUPERSEDED';

export interface QuotesTable {
  id: string;
  tenant_id: string;
  shipment_id: string;
  reference: string;
  currency: Generated<string>;
  status: Generated<QuoteStatus>;
  valid_until: Nullable<Date>;
  notes: Nullable<string>;
  vat_rate_bp: Generated<number>;
  vat_verification_status: Generated<VerificationStatus>;
  subtotal_minor: Generated<number>;
  tax_minor: Generated<number>;
  total_minor: Generated<number>;
  created_at: Timestamp;
  updated_at: Timestamp;
  created_by: Nullable<string>;
  updated_by: Nullable<string>;
}

export interface QuoteLinesTable {
  id: string;
  tenant_id: string;
  quote_id: string;
  charge_type_code: string;
  description: string;
  quantity: number;
  unit_amount_minor: number;
  line_amount_minor: number;
  is_taxable: Generated<boolean>;
  tax_minor: Generated<number>;
  sort_order: Generated<number>;
  created_at: Timestamp;
}

export interface InvoicesTable {
  id: string;
  tenant_id: string;
  shipment_id: string;
  quote_id: Nullable<string>;
  number: string;
  currency: Generated<string>;
  status: Generated<InvoiceStatus>;
  issue_date: Nullable<Date>;
  due_date: Nullable<Date>;
  notes: Nullable<string>;
  exchange_rate: Nullable<string>;
  vat_rate_bp: Generated<number>;
  vat_verification_status: Generated<VerificationStatus>;
  subtotal_minor: Generated<number>;
  tax_minor: Generated<number>;
  total_minor: Generated<number>;
  amount_paid_minor: Generated<number>;
  issued_at: Nullable<Date>;
  voided_at: Nullable<Date>;
  void_reason: Nullable<string>;
  created_at: Timestamp;
  updated_at: Timestamp;
  created_by: Nullable<string>;
  updated_by: Nullable<string>;
}

export interface InvoiceLinesTable {
  id: string;
  tenant_id: string;
  invoice_id: string;
  charge_type_code: string;
  description: string;
  quantity: number;
  unit_amount_minor: number;
  line_amount_minor: number;
  is_taxable: Generated<boolean>;
  tax_minor: Generated<number>;
  sort_order: Generated<number>;
  created_at: Timestamp;
}

export interface PaymentsTable {
  id: string;
  tenant_id: string;
  invoice_id: string;
  amount_minor: number;
  currency: Generated<string>;
  method: PaymentMethod;
  reference: Nullable<string>;
  paid_on: Date;
  note: Nullable<string>;
  recorded_by: Nullable<string>;
  created_at: Timestamp;
}

export interface InvoiceCountersTable {
  tenant_id: string;
  last_number: Generated<number>;
}

export interface Database {
  tenants: TenantsTable;
  users: UsersTable;
  refresh_tokens: RefreshTokensTable;
  audit_logs: AuditLogsTable;
  shipments: ShipmentsTable;
  shipment_events: ShipmentEventsTable;
  tariff_schedules: TariffSchedulesTable;
  tariff_lines: TariffLinesTable;
  documents: DocumentsTable;
  files: FilesTable;
  document_requirements: DocumentRequirementsTable;
  charge_types: ChargeTypesTable;
  tax_rates: TaxRatesTable;
  quotes: QuotesTable;
  quote_lines: QuoteLinesTable;
  invoices: InvoicesTable;
  invoice_lines: InvoiceLinesTable;
  payments: PaymentsTable;
  invoice_counters: InvoiceCountersTable;
}

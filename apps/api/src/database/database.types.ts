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
  /** Importer tax number (TPIN). Synthetic in demo data. */
  tpin: Nullable<string>;
  /** Optional contact number for the SMS mock interface. Never logged. */
  phone: Nullable<string>;
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
  /** Importer (client_viewer) this shipment is visible to. */
  importer_user_id: Nullable<string>;
  /** Agent staff member responsible for the review workflow. */
  assigned_agent_id: Nullable<string>;
  /** Driver who may record a manual border check-in. */
  driver_user_id: Nullable<string>;
  /** Bumped on material edits; review revisions pin their baseline. */
  review_freshness: Generated<number>;
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
  source: Generated<'manual' | 'system' | 'driver'>;
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

export type CaseKind = 'vehicle' | 'goods';

export interface DocumentRequirementsTable {
  id: string;
  tenant_id: string;
  shipment_type: ShipmentType;
  /** NULL applies to every case kind; otherwise targets one kind only. */
  case_kind: Nullable<CaseKind>;
  doc_type: string;
  label: string;
  is_mandatory: Generated<boolean>;
  sort_order: Generated<number>;
  is_active: Generated<boolean>;
  /** Provenance of the rule; never an assessment or a legal requirement by default. */
  source_url: Nullable<string>;
  effective_date: Nullable<Date>;
  verification_status: Generated<VerificationStatus>;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface RegistryGuidanceTable {
  id: string;
  tenant_id: string;
  step_key: string;
  title: string;
  detail: Nullable<string>;
  sort_order: Generated<number>;
  is_active: Generated<boolean>;
  source_url: Nullable<string>;
  effective_date: Nullable<Date>;
  verification_status: Generated<VerificationStatus>;
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

export interface NotificationOutboxTable {
  id: string;
  tenant_id: string;
  event_type: string;
  entity_type: Nullable<string>;
  entity_id: Nullable<string>;
  recipient_user_id: Nullable<string>;
  recipient_email: string;
  recipient_phone: Nullable<string>;
  channel: 'email' | 'mock' | 'sms_mock';
  subject: string;
  body: string;
  status: 'sent' | 'skipped' | 'failed';
  detail: Nullable<string>;
  created_at: Timestamp;
}

export type ImporterReviewState = 'draft' | 'in_review' | 'queried' | 'approved';
/** jsonb column: array of deterministic draft-check findings. */
export type DraftFindingRow = {
  code: string;
  field: string | null;
  message: string;
  severity: 'error' | 'warning';
};
export type ReviewPointEvent = 'review_sent' | 'review_approved';

export interface ImporterReviewsTable {
  id: string;
  tenant_id: string;
  shipment_id: string;
  revision: number;
  parent_review_id: Nullable<string>;
  state: Generated<ImporterReviewState>;
  message: Nullable<string>;
  query: Nullable<string>;
  sent_at: Nullable<Date>;
  queried_at: Nullable<Date>;
  approved_at: Nullable<Date>;
  sent_by: Nullable<string>;
  approved_by: Nullable<string>;
  shipment_reference: string;
  client_name: string;
  client_contact: Nullable<string>;
  shipment_type: ShipmentType;
  origin: Nullable<string>;
  destination: Nullable<string>;
  consignment: Generated<Record<string, unknown>>;
  baseline_freshness: number;
  draft_findings: Generated<DraftFindingRow[]>;
  draft_check_version: Generated<number>;
  draft_blocked: Generated<boolean>;
  wording: Nullable<string>;
  wording_source: Generated<'fixed' | 'ai'>;
  created_at: Timestamp;
  updated_at: Timestamp;
  created_by: Nullable<string>;
}

export interface ReviewPointsTable {
  id: string;
  tenant_id: string;
  user_id: string;
  shipment_id: string;
  review_id: string;
  event: ReviewPointEvent;
  points: number;
  created_at: Timestamp;
}

export interface AgentProfilesTable {
  id: string;
  tenant_id: string;
  user_id: string;
  agency_name: string;
  location: string;
  service_area: Nullable<string>;
  languages: Nullable<string>;
  notes: Nullable<string>;
  /** SIMULATED until a real ZRA source is verified. Never a live ZRA status. */
  licence_status: Generated<'SIMULATED' | 'VERIFIED'>;
  is_published: Generated<boolean>;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface AppointmentsTable {
  id: string;
  tenant_id: string;
  case_id: string;
  importer_user_id: string;
  agent_user_id: string;
  from_tenant_id: string;
  consent_text: string;
  created_at: Timestamp;
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
  registry_guidance: RegistryGuidanceTable;
  charge_types: ChargeTypesTable;
  tax_rates: TaxRatesTable;
  quotes: QuotesTable;
  quote_lines: QuoteLinesTable;
  invoices: InvoicesTable;
  invoice_lines: InvoiceLinesTable;
  payments: PaymentsTable;
  invoice_counters: InvoiceCountersTable;
  notification_outbox: NotificationOutboxTable;
  importer_reviews: ImporterReviewsTable;
  review_points: ReviewPointsTable;
  agent_profiles: AgentProfilesTable;
  appointments: AppointmentsTable;
}

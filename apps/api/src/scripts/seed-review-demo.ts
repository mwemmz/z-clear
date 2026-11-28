/**
 * Local demo-data reset (src/scripts/seed-review-demo.ts).
 *
 * Creates the demo state used by the prototype: one agent, an admin, an
 * assigned importer, an unrelated importer (for isolation checks), a driver,
 * one shipment with an in-flight review revision and one seeded points entry.
 * Synthetic data only — names, emails, phone numbers and TPINs are invented
 * placeholders, and no duty/tax/fee numbers are used anywhere.
 *
 * Usage (after pnpm --filter @zclear/api build):
 *   DATABASE_URL=postgresql://... DEMO_PASSWORD=<local-demo-password> \
 *     node dist/scripts/seed-review-demo.js
 *
 * Hosted seed on Render (HOSTED_DEMO_PASSWORD comes from the service
 * environment; no credential is passed on the command line):
 *   corepack pnpm --filter @zclear/api db:seed:hosted
 *
 * The password comes only from DEMO_PASSWORD locally, or HOSTED_DEMO_PASSWORD
 * in the explicit `--hosted` mode; it is never hardcoded in the app or logged.
 * The default path is a *local demo reset* and refuses to run in production.
 * The hosted path seeds the same fixed synthetic tenant only on its first run;
 * a tenant-owned marker row makes later boots skip without resetting real work.
 */
import 'dotenv/config';
import { Client } from 'pg';
import type { Role } from '../common/roles';
import { PasswordService } from '../modules/auth/password.service';

const TENANT_ID = '01920000-0000-7000-8000-00000000d001';
const AGENT_ID = '01920000-0000-7000-8000-00000000d002';
const IMPORTER_ID = '01920000-0000-7000-8000-00000000d003';
const OTHER_IMPORTER_ID = '01920000-0000-7000-8000-00000000d004';
const SHIPMENT_ID = '01920000-0000-7000-8000-00000000d005';
const EVENT_ID = '01920000-0000-7000-8000-00000000d006';
const REVIEW_ID = '01920000-0000-7000-8000-00000000d007';
const POINTS_ID = '01920000-0000-7000-8000-00000000d008';
const ADMIN_ID = '01920000-0000-7000-8000-00000000d009';
const DRIVER_ID = '01920000-0000-7000-8000-00000000d00a';
const INVOICE_ID = '01920000-0000-7000-8000-00000000d00b';
const INVOICE_LINE_ID = '01920000-0000-7000-8000-00000000d00c';

/** Bump this only when a deliberate hosted demo reset is required. */
export const HOSTED_SEED_VERSION = '2026-11-28-1';

/**
 * Synthetic agency service fee only — not a customs assessment, duty, VAT or a
 * payable amount. The demo uses it solely to show manual payment capture.
 */
export const DEMO_INVOICE = {
  id: INVOICE_ID,
  number: 'INV-0001',
  amountMinor: 60_000,
  note: 'Synthetic demo: agency clearance service fee only. Not a ZRA assessment; no duty or VAT included.',
} as const;

// Synthetic TPINs: clearly fake, digits only. The shipment TPIN matches the
// assigned importer's on purpose; the other importer carries a different one.
const AGENT_EMAIL = 'agent@demo-clearing.example';
const IMPORTER_EMAIL = 'importer@kafuemetals.example';
const OTHER_IMPORTER_EMAIL = 'other.importer@sunshine-trading.example';
const ADMIN_EMAIL = 'admin@demo-clearing.example';
const DRIVER_EMAIL = 'driver@demo-clearing.example';

export interface DemoUser {
  id: string;
  email: string;
  role: Role;
  label: string;
  tpin: string | null;
  phone: string | null;
}

/** The four demo logins shown on the login page's role guide. */
export const DEMO_LOGINS: readonly DemoUser[] = [
  {
    id: AGENT_ID,
    email: AGENT_EMAIL,
    role: 'agent_staff',
    label: 'Clearing agent',
    tpin: null,
    phone: '+260900000001',
  },
  {
    id: IMPORTER_ID,
    email: IMPORTER_EMAIL,
    role: 'client_viewer',
    label: 'Importer / client',
    tpin: '1001111222',
    phone: '+260900000002',
  },
  {
    id: ADMIN_ID,
    email: ADMIN_EMAIL,
    role: 'platform_admin',
    label: 'Platform admin',
    tpin: null,
    phone: null,
  },
  {
    id: DRIVER_ID,
    email: DRIVER_EMAIL,
    role: 'driver',
    label: 'Driver',
    tpin: null,
    phone: null,
  },
];

/** Extra importer used by isolation tests; not one of the four demo logins. */
export const DEMO_USERS: readonly DemoUser[] = [
  ...DEMO_LOGINS,
  {
    id: OTHER_IMPORTER_ID,
    email: OTHER_IMPORTER_EMAIL,
    role: 'client_viewer',
    label: 'Unrelated importer (isolation check)',
    tpin: '2002222333',
    phone: null,
  },
];

/** Local password is supplied by the operator; no credential is stored in source. */
export function demoPassword(): string {
  const password = process.env.DEMO_PASSWORD;
  if (!password || password.length < 8) {
    throw new Error('DEMO_PASSWORD must be set to at least 8 characters for local demo seeding');
  }
  return password;
}

/** Hosted password is separate so local and deployed demo logins cannot be confused. */
export function hostedDemoPassword(): string {
  const password = process.env.HOSTED_DEMO_PASSWORD;
  if (!password || password.length < 12) {
    throw new Error(
      'HOSTED_DEMO_PASSWORD must be set to at least 12 characters for hosted demo seeding',
    );
  }
  return password;
}

/** Resolve the seed mode explicitly so production can never seed by accident. */
export function resolveSeedPassword(options: { hosted: boolean; nodeEnv?: string }): string {
  const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV;
  if (options.hosted) {
    if (nodeEnv !== 'production') {
      throw new Error('Hosted demo seeding requires NODE_ENV=production');
    }
    return hostedDemoPassword();
  }
  if (nodeEnv === 'production') {
    throw new Error('Refusing to seed demo data in production');
  }
  return demoPassword();
}

/** Minimal query surface shared by pg's Client and the marker unit tests. */
export interface SeedQueryClient {
  query(text: string, values?: unknown[]): Promise<{ rowCount?: number | null }>;
}

/** True once the hosted demo has been seeded for this tenant. */
export async function hostedSeedAlreadyApplied(db: SeedQueryClient): Promise<boolean> {
  const result = await db.query('select 1 from demo_seed_state where tenant_id = $1', [TENANT_ID]);
  return (result.rowCount ?? 0) > 0;
}

/** Written in the same transaction as the seed so a failed seed never marks itself done. */
export async function markSeedApplied(db: SeedQueryClient, version: string): Promise<void> {
  await db.query(
    `insert into demo_seed_state (tenant_id, seed_version)
     values ($1, $2)
     on conflict (tenant_id) do update set seed_version = excluded.seed_version, seeded_at = now()`,
    [TENANT_ID, version],
  );
}

async function main(): Promise<void> {
  const hosted = process.argv.includes('--hosted');
  const password = resolveSeedPassword({ hosted });
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  const passwordHash = await new PasswordService().hash(password);
  const db = new Client({ connectionString: url });
  await db.connect();
  try {
    await db.query('begin');
    await db.query(`select set_config('app.tenant_id', $1, true)`, [TENANT_ID]);
    // Serialise concurrent boots so only one can claim the first seed.
    await db.query(`select pg_advisory_xact_lock(hashtext($1))`, ['zclear-hosted-demo-seed']);
    if (hosted && (await hostedSeedAlreadyApplied(db))) {
      await db.query('commit');
      console.log('Hosted demo seed already applied; skipping.');
      return;
    }

    // Reset: clear the demo shipment's *extra* review revisions (anything a
    // previous demo/smoke run added beyond the seeded revision 1). The
    // append-only points ledger can never be deleted, so revisions that a
    // ledger entry still references are kept and merely reset to a neutral
    // state below; unreferenced extras are deleted.
    await db.query(
      `delete from importer_reviews r
       where r.shipment_id = $1 and r.revision > 1
         and not exists (select 1 from review_points p where p.review_id = r.id)`,
      [SHIPMENT_ID],
    );
    await db.query(
      `update importer_reviews set state = 'queried', query = 'Reset by reseed',
         approved_at = null, approved_by = null, updated_at = now()
       where shipment_id = $1 and revision > 1`,
      [SHIPMENT_ID],
    );

    await db.query(
      `insert into tenants (id, name) values ($1, 'Demo Clearing Agency')
       on conflict (id) do update set name = excluded.name`,
      [TENANT_ID],
    );
    for (const user of DEMO_USERS) {
      await db.query(
        `insert into users (id, tenant_id, email, password_hash, role, tpin, phone, is_active)
         values ($1, $2, $3, $4, $5, $6, $7, true)
         on conflict (id) do update set
           email = excluded.email, password_hash = excluded.password_hash,
           role = excluded.role, tpin = excluded.tpin, phone = excluded.phone,
           is_active = true`,
        [user.id, TENANT_ID, user.email, passwordHash, user.role, user.tpin, user.phone],
      );
    }

    await db.query(
      `insert into shipments (id, tenant_id, reference, client_name, client_contact, type,
         origin, destination, consignment, importer_user_id, assigned_agent_id, driver_user_id)
       values ($1, $2, 'DEMO-IMPORT-0001', 'Kafue Metals Ltd', 'imports@kafuemetals.example',
         'import', 'Durban', 'Lusaka', $3::jsonb, $4, $5, $6)
       on conflict (id) do update set
         reference = excluded.reference, client_name = excluded.client_name,
         consignment = excluded.consignment, importer_user_id = excluded.importer_user_id,
         assigned_agent_id = excluded.assigned_agent_id,
         driver_user_id = excluded.driver_user_id, review_freshness = 0`,
      [
        SHIPMENT_ID,
        TENANT_ID,
        JSON.stringify({ tpin: '1001111222' }),
        IMPORTER_ID,
        AGENT_ID,
        DRIVER_ID,
      ],
    );
    await db.query(
      `insert into shipment_events (id, tenant_id, shipment_id, from_stage, to_stage, note, source, actor_user_id)
       values ($1, $2, $3, null, 'docs_received', 'Demo shipment created', 'system', $4)
       on conflict (id) do nothing`,
      [EVENT_ID, TENANT_ID, SHIPMENT_ID, AGENT_ID],
    );
    await db.query(
      `insert into importer_reviews (id, tenant_id, shipment_id, revision, state, message,
         shipment_reference, client_name, client_contact, shipment_type, origin, destination,
         consignment, baseline_freshness, sent_at, sent_by)
       values ($1, $2, $3, 1, 'in_review', 'Demo review sent to the importer.',
         'DEMO-IMPORT-0001', 'Kafue Metals Ltd', 'imports@kafuemetals.example', 'import',
         'Durban', 'Lusaka', '{}'::jsonb, 0, now(), $4)
       on conflict (id) do update set state = 'in_review', query = null,
         queried_at = null, approved_at = null, approved_by = null`,
      [REVIEW_ID, TENANT_ID, SHIPMENT_ID, AGENT_ID],
    );
    await db.query(
      `insert into review_points (id, tenant_id, user_id, shipment_id, review_id, event, points)
       values ($1, $2, $3, $4, $5, 'review_sent', 10)
       on conflict (tenant_id, review_id, event) do nothing`,
      [POINTS_ID, TENANT_ID, AGENT_ID, SHIPMENT_ID, REVIEW_ID],
    );

    // One issued invoice with a labelled agency service amount only. No duty,
    // VAT or ZRA assessment figure is invented for the demo.
    await db.query(
      `insert into invoices (id, tenant_id, shipment_id, number, currency, status, issue_date,
         notes, vat_rate_bp, vat_verification_status, subtotal_minor, tax_minor, total_minor,
         amount_paid_minor, issued_at, created_by, updated_by)
       values ($1, $2, $3, $4, 'ZMW', 'issued', CURRENT_DATE, $5, 0, 'NEEDS_VERIFICATION',
         $6, 0, $6, 0, now(), $7, $7)
       on conflict (id) do nothing`,
      [
        INVOICE_ID,
        TENANT_ID,
        SHIPMENT_ID,
        DEMO_INVOICE.number,
        DEMO_INVOICE.note,
        DEMO_INVOICE.amountMinor,
        AGENT_ID,
      ],
    );
    await db.query(
      `insert into invoice_lines (id, tenant_id, invoice_id, charge_type_code, description,
         quantity, unit_amount_minor, line_amount_minor, is_taxable, tax_minor, sort_order)
       values ($1, $2, $3, 'agency_fee', 'Agency clearance service fee (synthetic)',
         1, $4, $4, false, 0, 1)
       on conflict (id) do nothing`,
      [INVOICE_LINE_ID, TENANT_ID, INVOICE_ID, DEMO_INVOICE.amountMinor],
    );
    await db.query(
      `insert into invoice_counters (tenant_id, last_number) values ($1, 1)
       on conflict (tenant_id) do update
         set last_number = greatest(invoice_counters.last_number, excluded.last_number)`,
      [TENANT_ID],
    );
    await markSeedApplied(db, HOSTED_SEED_VERSION);

    await db.query('commit');
    console.log(
      `${hosted ? 'Hosted' : 'Local'} demo seed complete. ` +
        `Demo logins: ${DEMO_LOGINS.map((user) => `${user.label} ${user.email}`).join(' | ')} | ` +
        'shipment DEMO-IMPORT-0001 | review in_review | 10 seeded points | ' +
        `issued invoice ${DEMO_INVOICE.number} (agency service fee only, not a ZRA assessment)`,
    );
  } catch (error) {
    await db.query('rollback');
    throw error;
  } finally {
    await db.end();
  }
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

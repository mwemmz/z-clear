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
 * The password comes only from DEMO_PASSWORD; it is never hardcoded in the app
 * or logged. This is a *local demo reset*: it upserts fixed demo rows and
 * refuses to run in production.
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

/** Password is supplied by the operator; no credential is stored in source. */
export function demoPassword(): string {
  const password = process.env.DEMO_PASSWORD;
  if (!password || password.length < 8) {
    throw new Error('DEMO_PASSWORD must be set to at least 8 characters for local demo seeding');
  }
  return password;
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed demo data in production');
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  const passwordHash = await new PasswordService().hash(demoPassword());
  const db = new Client({ connectionString: url });
  await db.connect();
  try {
    await db.query('begin');
    await db.query(`select set_config('app.tenant_id', $1, true)`, [TENANT_ID]);

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

    await db.query('commit');
    console.log(
      `Seed complete. Demo logins: ${DEMO_LOGINS.map((user) => `${user.label} ${user.email}`).join(' | ')} | ` +
        'shipment DEMO-IMPORT-0001 | review in_review | 10 seeded points',
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

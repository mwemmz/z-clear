/**
 * Local demo-data reset (src/scripts/seed-review-demo.ts).
 *
 * Creates the importer-review demo state: one agent, an assigned importer, an
 * unrelated importer, one draft shipment with an in-flight review revision and
 * one seeded points entry. Synthetic data only — names, emails and the TPINs
 * are invented placeholders, and no duty/tax/fee numbers are used anywhere.
 *
 * Usage (after pnpm --filter @zclear/api build):
 *   DATABASE_URL=postgresql://... node dist/scripts/seed-review-demo.js
 *
 * This is a *reset for local demo data only*: it upserts fixed demo rows and
 * refuses to run in production.
 */
import { Client } from 'pg';

const TENANT_ID = '01920000-0000-7000-8000-00000000d001';
const AGENT_ID = '01920000-0000-7000-8000-00000000d002';
const IMPORTER_ID = '01920000-0000-7000-8000-00000000d003';
const OTHER_IMPORTER_ID = '01920000-0000-7000-8000-00000000d004';
const SHIPMENT_ID = '01920000-0000-7000-8000-00000000d005';
const EVENT_ID = '01920000-0000-7000-8000-00000000d006';
const REVIEW_ID = '01920000-0000-7000-8000-00000000d007';
const POINTS_ID = '01920000-0000-7000-8000-00000000d008';

// Synthetic TPINs: clearly fake, digits only. The shipment TPIN matches the
// assigned importer's on purpose; the other importer carries a different one.
const AGENT_EMAIL = 'agent@demo-clearing.example';
const IMPORTER_EMAIL = 'importer@kafuemetals.example';
const OTHER_IMPORTER_EMAIL = 'other.importer@sunshine-trading.example';

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed demo data in production');
  }
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
    // Demo password hashes are deliberately invalid Argon2 strings: fixtures,
    // not logins. Real users are created through POST /users.
    for (const [id, email, role, tpin] of [
      [AGENT_ID, AGENT_EMAIL, 'agent_staff', null],
      [IMPORTER_ID, IMPORTER_EMAIL, 'client_viewer', '1001111222'],
      [OTHER_IMPORTER_ID, OTHER_IMPORTER_EMAIL, 'client_viewer', '2002222333'],
    ] as const) {
      await db.query(
        `insert into users (id, tenant_id, email, password_hash, role, tpin)
         values ($1, $2, $3, 'demo-fixture-not-a-real-password-hash', $4, $5)
         on conflict (id) do update set email = excluded.email, role = excluded.role, tpin = excluded.tpin`,
        [id, TENANT_ID, email, role, tpin],
      );
    }

    await db.query(
      `insert into shipments (id, tenant_id, reference, client_name, client_contact, type,
         origin, destination, consignment, importer_user_id, assigned_agent_id)
       values ($1, $2, 'DEMO-IMPORT-0001', 'Kafue Metals Ltd', 'imports@kafuemetals.example',
         'import', 'Durban', 'Lusaka', $3::jsonb, $4, $5)
       on conflict (id) do update set
         reference = excluded.reference, client_name = excluded.client_name,
         consignment = excluded.consignment, importer_user_id = excluded.importer_user_id,
         assigned_agent_id = excluded.assigned_agent_id, review_freshness = 0`,
      [SHIPMENT_ID, TENANT_ID, JSON.stringify({ tpin: '1001111222' }), IMPORTER_ID, AGENT_ID],
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
      `Seed complete. Agent ${AGENT_EMAIL} | importer ${IMPORTER_EMAIL} (assigned) | ` +
        `unrelated importer ${OTHER_IMPORTER_EMAIL} | shipment DEMO-IMPORT-0001 | ` +
        `review in_review | 10 seeded points`,
    );
  } catch (error) {
    await db.query('rollback');
    throw error;
  } finally {
    await db.end();
  }
}

void main();

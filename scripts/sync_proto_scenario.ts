import { promises as fs } from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { RawEvent } from '@/lib/detection/models';

interface ScenarioEvent {
  label: string;
  notes?: string;
  event: RawEvent;
  expectedSegment?: string;
  expectedRule?: string;
}

const SCENARIO_PATH = path.join(process.cwd(), 'data', 'mock', 'protoScenario.json');
const SCHEMA_SQL_PATH = path.join(process.cwd(), 'scripts', 'sql', 'proto_vercel_schema.sql');

const DB_URL =
  process.env.PROTO_DB_URL ||
  process.env.RUNTIME_ALERTS_DB_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.SUPABASE_DB_URL;

if (!DB_URL) {
  console.error('❌ DATABASE_URL/PROTO_DB_URL が設定されていません。');
  process.exit(1);
}

const pool = new Pool({ connectionString: DB_URL });

const UPSERT_SQL = `
INSERT INTO proto_raw_events (id, label, notes, event, expected_segment, expected_rule, occurred_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  notes = EXCLUDED.notes,
  event = EXCLUDED.event,
  expected_segment = EXCLUDED.expected_segment,
  expected_rule = EXCLUDED.expected_rule,
  occurred_at = EXCLUDED.occurred_at,
  updated_at = NOW()
`;

async function ensureSchema() {
  const sql = await fs.readFile(SCHEMA_SQL_PATH, 'utf-8');
  await pool.query(sql);
}

async function loadScenario(): Promise<ScenarioEvent[]> {
  const raw = await fs.readFile(SCENARIO_PATH, 'utf-8');
  return JSON.parse(raw) as ScenarioEvent[];
}

async function main() {
  await ensureSchema();
  const scenarios = await loadScenario();
  console.log(`📦 シナリオ ${scenarios.length} 件を ${DB_URL} に同期します。`);

  for (const scenario of scenarios) {
    const { event, label, notes, expectedSegment, expectedRule } = scenario;
    const occurredAt = event.occurredAt ? new Date(event.occurredAt).toISOString() : null;
    await pool.query(UPSERT_SQL, [
      event.id,
      label,
      notes ?? null,
      JSON.stringify(event),
      expectedSegment ?? null,
      expectedRule ?? null,
      occurredAt,
    ]);
    console.log(`  ✅ upsert: ${event.id} (${label})`);
  }

  console.log('🎉 proto_raw_events への同期が完了しました。');
  await pool.end();
}

main().catch(async (error) => {
  console.error('シナリオ同期に失敗しました:', error);
  await pool.end();
  process.exit(1);
});

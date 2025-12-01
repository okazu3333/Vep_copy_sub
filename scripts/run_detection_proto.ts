import { promises as fs } from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { evaluateEvent } from '../lib/detection/engine';
import { buildAlertFromMatch } from '../lib/detection/alert-builder';
import { RawEvent, RuntimeAlert } from '../lib/detection/models';
import { appendRuntimeAlerts } from '../lib/detection/store';
import { SegmentKey } from '@/lib/segments';

interface ScenarioEvent {
  label: string;
  notes?: string;
  event: RawEvent;
  expectedSegment?: SegmentKey;
  expectedRule?: string;
}

const SCENARIO_PATH = path.join(process.cwd(), 'data', 'mock', 'protoScenario.json');
const PROTO_SOURCE = process.env.PROTO_SCENARIO_SOURCE ?? 'file';
const DB_URL =
  process.env.PROTO_DB_URL ||
  process.env.RUNTIME_ALERTS_DB_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.SUPABASE_DB_URL ||
  null;

let pool: Pool | null = null;

const getPool = () => {
  if (!DB_URL) {
    throw new Error('PROTO_SCENARIO_SOURCE=db を使用する場合は DATABASE_URL/PROTO_DB_URL が必要です。');
  }
  if (!pool) {
    pool = new Pool({ connectionString: DB_URL });
  }
  return pool;
};

async function loadScenario(): Promise<ScenarioEvent[]> {
  const raw = await fs.readFile(SCENARIO_PATH, 'utf-8');
  return JSON.parse(raw) as ScenarioEvent[];
}

async function loadScenarioFromDb(): Promise<ScenarioEvent[]> {
  const client = getPool();
  const { rows } = await client.query(
    `SELECT
      id,
      COALESCE(label, id) AS label,
      notes,
      event,
      expected_segment,
      expected_rule
    FROM proto_raw_events
    ORDER BY occurred_at NULLS LAST, id`
  );

  return rows.map((row) => ({
    label: row.label,
    notes: row.notes ?? undefined,
    event: row.event as RawEvent,
    expectedSegment: (row.expected_segment ?? undefined) as SegmentKey | undefined,
    expectedRule: row.expected_rule ?? undefined,
  }));
}

async function loadScenarioPayload(): Promise<ScenarioEvent[]> {
  if (PROTO_SOURCE === 'db') {
    console.log('🗄️  DB からシナリオを取得します');
    return loadScenarioFromDb();
  }
  return loadScenario();
}

async function main() {
  const scenarios = await loadScenarioPayload();
  const generated: RuntimeAlert[] = [];

  console.log('--- 検知モデル プロトシナリオ実行 ---');
  for (const scenario of scenarios) {
    const { event, expectedSegment, expectedRule, label, notes } = scenario;
    console.log(`\n[${event.id}] ${label}`);
    if (notes) {
      console.log(`  📝 ${notes}`);
    }

    const matches = evaluateEvent(event);
    if (matches.length === 0) {
      console.warn('  ⚠️ ルール判定なし');
      continue;
    }

    matches.forEach((match) => {
      const alert = buildAlertFromMatch(event, match);
      generated.push({
        ...alert,
        sourceEventId: event.id,
      });

      const isExpectedSegment = expectedSegment ? match.segment === expectedSegment : 'n/a';
      const isExpectedRule = expectedRule ? match.rule === expectedRule : 'n/a';
      console.log(
        `  ✅ Detect: segment=${match.segment} rule=${match.rule} ` +
          `(segment match: ${isExpectedSegment}, rule match: ${isExpectedRule})`
      );
      console.log(`     reasons: ${match.reasons.join(' / ')}`);
    });
  }

  if (generated.length) {
    await appendRuntimeAlerts(generated);
    console.log(`\n🗂  runtime-alerts.json に ${generated.length} 件のアラートを追加しました。`);
  } else {
    console.log('\n⚠️ 生成されたアラートはありませんでした。');
  }
}

main().catch((error) => {
  console.error('プロトシナリオの実行に失敗しました', error);
  process.exit(1);
}).finally(async () => {
  if (pool) {
    await pool.end();
  }
});

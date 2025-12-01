import { promises as fs } from 'fs';
import path from 'path';
import { RuntimeAlert, RuntimeAlertStore } from './models';
import { Pool } from 'pg';

const STORE_PATH = path.join(process.cwd(), 'artifacts', 'runtime-alerts.json');
const STORE_DRIVER = process.env.RUNTIME_ALERTS_DRIVER ?? 'fs';
const RUNTIME_ALERTS_TABLE = process.env.RUNTIME_ALERTS_TABLE ?? 'proto_runtime_alerts';
const DB_URL =
  process.env.RUNTIME_ALERTS_DB_URL ||
  process.env.PROTO_DB_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.SUPABASE_DB_URL ||
  null;

const isDbDriver = STORE_DRIVER === 'db';
let pool: Pool | null = null;

const validateTableName = (table: string) => {
  if (!/^[a-zA-Z0-9_]+$/.test(table)) {
    throw new Error(`Invalid table name: ${table}`);
  }
};

const getPool = () => {
  if (!DB_URL) {
    throw new Error('RUNTIME_ALERTS_DRIVER=db を使用するには DATABASE_URL などの接続情報が必要です。');
  }
  if (!pool) {
    pool = new Pool({ connectionString: DB_URL });
  }
  return pool;
};

const ensureDbTable = async () => {
  if (!isDbDriver) return;
  validateTableName(RUNTIME_ALERTS_TABLE);
  const client = getPool();
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${RUNTIME_ALERTS_TABLE} (
      id TEXT PRIMARY KEY,
      source_event_id TEXT,
      segment TEXT,
      rule TEXT,
      severity TEXT,
      urgency_score INTEGER,
      payload JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS ${RUNTIME_ALERTS_TABLE}_segment_idx ON ${RUNTIME_ALERTS_TABLE} (segment);
    CREATE INDEX IF NOT EXISTS ${RUNTIME_ALERTS_TABLE}_event_idx ON ${RUNTIME_ALERTS_TABLE} (source_event_id);
  `);
};

const ensureDir = async () => {
  const dir = path.dirname(STORE_PATH);
  await fs.mkdir(dir, { recursive: true });
};

export const readRuntimeAlerts = async (): Promise<RuntimeAlertStore> => {
  if (isDbDriver) {
    await ensureDbTable();
    validateTableName(RUNTIME_ALERTS_TABLE);
    const client = getPool();
    const { rows } = await client.query(
      `SELECT payload, updated_at FROM ${RUNTIME_ALERTS_TABLE} ORDER BY updated_at DESC LIMIT 200`
    );
    const alerts = rows.map((row) => row.payload as RuntimeAlert);
    const updatedAt = rows[0]?.updated_at
      ? new Date(rows[0].updated_at).toISOString()
      : new Date().toISOString();
    return { alerts, updatedAt };
  }

  try {
    const raw = await fs.readFile(STORE_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (error) {
    return { alerts: [], updatedAt: new Date().toISOString() };
  }
};

export const writeRuntimeAlerts = async (alertStore: RuntimeAlertStore) => {
  if (isDbDriver) {
    await ensureDbTable();
    validateTableName(RUNTIME_ALERTS_TABLE);
    const client = getPool();
    await client.query(`TRUNCATE TABLE ${RUNTIME_ALERTS_TABLE}`);
    const insertSql = `
      INSERT INTO ${RUNTIME_ALERTS_TABLE} (id, source_event_id, segment, rule, severity, urgency_score, payload, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (id) DO UPDATE SET
        source_event_id = EXCLUDED.source_event_id,
        segment = EXCLUDED.segment,
        rule = EXCLUDED.rule,
        severity = EXCLUDED.severity,
        urgency_score = EXCLUDED.urgency_score,
        payload = EXCLUDED.payload,
        updated_at = NOW();
    `;
    for (const alert of alertStore.alerts) {
      await client.query(insertSql, [
        alert.id,
        (alert as RuntimeAlert).sourceEventId ?? null,
        alert.primarySegment ?? null,
        alert.detectionRule?.rule_type ?? null,
        alert.severity,
        alert.urgencyScore ?? null,
        JSON.stringify(alert),
      ]);
    }
    return;
  }

  await ensureDir();
  await fs.writeFile(
    STORE_PATH,
    JSON.stringify(alertStore, null, 2),
    'utf-8'
  );
};

export const appendRuntimeAlerts = async (alerts: RuntimeAlert[]) => {
  if (!alerts.length) return;
  if (isDbDriver) {
    await ensureDbTable();
    validateTableName(RUNTIME_ALERTS_TABLE);
    const client = getPool();
    const insertSql = `
      INSERT INTO ${RUNTIME_ALERTS_TABLE} (id, source_event_id, segment, rule, severity, urgency_score, payload, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        source_event_id = EXCLUDED.source_event_id,
        segment = EXCLUDED.segment,
        rule = EXCLUDED.rule,
        severity = EXCLUDED.severity,
        urgency_score = EXCLUDED.urgency_score,
        payload = EXCLUDED.payload,
        updated_at = NOW();
    `;
    for (const alert of alerts) {
      await client.query(insertSql, [
        alert.id,
        alert.sourceEventId ?? null,
        alert.primarySegment ?? null,
        alert.detectionRule?.rule_type ?? null,
        alert.severity,
        alert.urgencyScore ?? null,
        JSON.stringify(alert),
      ]);
    }
    return;
  }

  const store = await readRuntimeAlerts();
  const updated = [...alerts, ...store.alerts].slice(0, 100);
  await writeRuntimeAlerts({
    alerts: updated,
    updatedAt: new Date().toISOString(),
  });
};

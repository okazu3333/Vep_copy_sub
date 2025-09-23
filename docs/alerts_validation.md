# Alerts Pipeline Validation Checklist

## 1. Static Checks

- `pnpm exec next lint --file app/api/alerts/route.ts`
- `pnpm exec next lint --file app/api/alerts-threaded/messages/route.ts`
- `pnpm exec next lint --file app/alerts/page.tsx`

## 2. BigQuery Dry-Run Monitoring

Both `/api/alerts` and `/api/alerts-threaded/messages` now issue a BigQuery dry-run before executing the live query. Tail logs to confirm estimated bytes:

```bash
vercel logs --source=stdout | rg "dry-run"
```

## 3. Required SQL Diagnostics

### 3.1 Alerts Null Ratios (last 30 days)
```sql
SELECT
  COUNT(*) AS total_rows,
  COUNTIF(keyword IS NULL OR keyword = '') / COUNT(*) AS keyword_null_ratio,
  COUNTIF(reply_level IS NULL) / COUNT(*) AS reply_level_null_ratio,
  COUNTIF(is_root IS NULL) / COUNT(*) AS is_root_null_ratio
FROM `viewpers.salesguard_alerts.alerts_v2_scored`
WHERE datetime >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY);
```

### 3.2 Unified vs Scored Count Delta (last 30 days)
```sql
WITH recent AS (
  SELECT message_id
  FROM `viewpers.salesguard_alerts.unified_email_messages`
  WHERE datetime >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
),
scored AS (
  SELECT message_id
  FROM `viewpers.salesguard_alerts.alerts_v2_scored`
  WHERE datetime >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
)
SELECT
  (SELECT COUNT(*) FROM recent) AS unified_count,
  (SELECT COUNT(*) FROM scored) AS scored_count,
  (SELECT COUNT(*) FROM recent EXCEPT DISTINCT SELECT message_id FROM scored) AS only_in_unified,
  (SELECT COUNT(*) FROM scored EXCEPT DISTINCT SELECT message_id FROM recent) AS only_in_scored;
```

### 3.3 View Dependencies
```sql
SELECT
  table_schema,
  table_name,
  view_definition
FROM `viewpers.salesguard_alerts.INFORMATION_SCHEMA.VIEWS`
ORDER BY table_name;
```

## 4. API Spot Checks

```bash
curl \
  'https://localhost:3000/api/alerts?start=2025-01-01T00:00:00Z&end=2025-01-31T00:00:00Z&limit=10&light=1' \
  -u cmgadmin:crossadmin

curl \
  'https://localhost:3000/api/alerts-threaded/messages?thread_id=<THREAD_ID>&start=2025-01-01T00:00:00Z&end=2025-01-31T00:00:00Z&mode=fast' \
  -u cmgadmin:crossadmin
```

## 5. Follow-Up Tasks (P1/P2 Prep)

- Materialized view build scripts for dashboard metrics (`mv_daily_company_risk`).
- Job monitoring hook: schedule `INFORMATION_SCHEMA.JOBS_BY_PROJECT` checks with notifications.
- Documented rollback procedure for `unified_email_messages` MERGE jobs.

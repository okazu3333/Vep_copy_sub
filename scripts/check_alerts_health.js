#!/usr/bin/env node
/*
 * Alerts health check script.
 * Outputs warnings when daily counts drop below threshold or gaps occur.
 * Usage: node scripts/check_alerts_health.js [--threshold=10] [--days=120]
 */
const { BigQuery } = require('@google-cloud/bigquery')

const argv = process.argv.slice(2)
const argMap = new Map(argv.map((arg) => {
  const [key, value] = arg.replace(/^--/, '').split('=')
  return [key, value || 'true']
}))

const projectId = process.env.GCP_PROJECT_ID
  || process.env.GOOGLE_CLOUD_PROJECT
  || process.env.PROJECT_ID
  || 'viewpers'
const location = process.env.BIGQUERY_LOCATION || 'asia-northeast1'
const threshold = Number(argMap.get('threshold') || process.env.ALERT_MIN_THRESHOLD || 10)
const days = Number(argMap.get('days') || 120)

async function main() {
  const bigquery = new BigQuery({ projectId, location })
  const query = `
    DECLARE start_date DATE DEFAULT DATE_SUB(CURRENT_DATE('Asia/Tokyo'), INTERVAL @days_minus DAY);

    WITH calendar AS (
      SELECT day
      FROM UNNEST(GENERATE_DATE_ARRAY(start_date, CURRENT_DATE('Asia/Tokyo'))) AS day
    ),
    daily AS (
      SELECT DATE(datetime) AS day, COUNT(*) AS alert_count
      FROM ` + "`viewpers.salesguard_alerts.alerts_v2_scored`" + `
      WHERE datetime >= TIMESTAMP(start_date, 'Asia/Tokyo')
      GROUP BY day
    )
    SELECT
      calendar.day,
      IFNULL(daily.alert_count, 0) AS alert_count
    FROM calendar
    LEFT JOIN daily USING (day)
    ORDER BY calendar.day;
  `

  const params = { days_minus: days - 1 }
  const [rows] = await bigquery.query({
    query,
    params,
    useLegacySql: false,
    maximumBytesBilled: '200000000',
  })

  const lowDays = rows.filter((row) => Number(row.alert_count) <= threshold)
  if (lowDays.length) {
    console.warn('⚠️ Alerts days below threshold detected:')
    lowDays.forEach((row) => {
      console.warn(`  ${row.day}: ${row.alert_count} alerts`)
    })
  } else {
    console.log('✅ No low-volume alert days detected within window')
  }

  const missingDays = rows.filter((row) => Number(row.alert_count) === 0)
  if (missingDays.length) {
    console.warn('⚠️ Zero-alert days detected (possible gaps):')
    missingDays.forEach((row) => console.warn(`  ${row.day}`))
  }
}

main().catch((err) => {
  console.error('Health check failed:', err)
  process.exit(1)
})

import { NextRequest, NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery({ projectId: 'viewpers' })

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const threadId = searchParams.get('thread_id') || ''
    const mode = (searchParams.get('mode') || 'fast').toLowerCase() // fast | full
    if (!threadId) {
      return NextResponse.json({ success: false, message: 'thread_id is required' }, { status: 400 })
    }

    // オプション: limit, days
    const rawLimit = parseInt(searchParams.get('limit') || (mode === 'fast' ? '100' : '300'))
    const limit = Math.max(1, Math.min(isFinite(rawLimit) ? rawLimit : 100, 500))
    const rawDays = parseInt(searchParams.get('days') || '1')
    const days = Math.max(1, Math.min(isFinite(rawDays) ? rawDays : 1, 30))

    let query = ''
    const params: Record<string, any> = { thread_id: threadId }

    if (mode === 'full') {
      // 精密版（normalized と結合し In-Reply-To / References を取得）
      query = `
        WITH Bounds AS (
          SELECT 
            TIMESTAMP_SUB(MIN(datetime), INTERVAL ${days} DAY) AS start_dt,
            TIMESTAMP_ADD(MAX(datetime), INTERVAL ${days} DAY) AS end_dt
          FROM \`viewpers.salesguard_alerts.alerts_v2_scored\`
          WHERE thread_id = @thread_id
        )
        SELECT
          m.message_id,
          m.subject,
          m.from_email AS \`from\`,
          ARRAY_TO_STRING(m.to_emails, ', ') AS \`to\`,
          m.body_preview AS body,
          m.date,
          m.reply_level,
          m.is_root,
          m.body_gcs_uri AS source_file,
          n.in_reply_to AS in_reply_to,
          n.references AS \`references\`
        FROM \`viewpers.salesguard_alerts.email_messages_threaded_v1\` m
        LEFT JOIN \`viewpers.salesguard_alerts.email_messages_normalized\` n
          ON n.message_id = m.message_id
        CROSS JOIN Bounds
        WHERE m.thread_id = @thread_id
          AND TIMESTAMP(m.date) BETWEEN COALESCE(start_dt, TIMESTAMP('1970-01-01')) AND COALESCE(end_dt, TIMESTAMP('9999-12-31'))
        ORDER BY m.reply_level ASC, TIMESTAMP(m.date) ASC
        LIMIT ${limit}
      `
    } else {
      // 高速版（alerts_v2_scoredから直接取得、ヘッダはNULL）
      query = `
        SELECT
          message_id,
          description AS subject,
          person AS \`from\`,
          '' AS \`to\`,
          messageBody AS body,
          datetime AS date,
          reply_level,
          is_root,
          source_file,
          CAST(NULL AS STRING) AS in_reply_to,
          CAST(NULL AS STRING) AS \`references\`
        FROM \`viewpers.salesguard_alerts.alerts_v2_scored\`
        WHERE thread_id = @thread_id
        ORDER BY reply_level ASC, date ASC
        LIMIT ${limit}
      `
    }

    const [rows] = await bigquery.query({
      query,
      params,
      useLegacySql: false,
      maximumBytesBilled: '20000000000'
    })

    // 総件数（軽量カウント）
    const [countRows] = await bigquery.query({
      query: `SELECT COUNT(*) AS totalCount FROM \`viewpers.salesguard_alerts.alerts_v2_scored\` WHERE thread_id = @thread_id`,
      params,
      useLegacySql: false,
      maximumBytesBilled: '100000000'
    })
    const totalCount = Number(countRows?.[0]?.totalCount || rows.length || 0)

    const response = NextResponse.json({ success: true, messages: rows, totalCount })
    response.headers.set('Cache-Control', 'public, max-age=120, s-maxage=120')
    response.headers.set('CDN-Cache-Control', 'public, max-age=120')
    response.headers.set('Vercel-CDN-Cache-Control', 'public, max-age=120')
    return response
  } catch (error: any) {
    console.error('Thread messages API error:', error)
    return NextResponse.json({ success: false, message: error.message || 'Failed to fetch messages' }, { status: 500 })
  }
} 
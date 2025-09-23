import { NextRequest, NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const PROJECT_ID = 'viewpers'
const ALERT_VIEW = '`viewpers.salesguard_alerts.alerts_v2_compat_unified`'
const MESSAGE_TABLE = '`viewpers.salesguard_alerts.email_messages_threaded_v1`'
const MESSAGE_NORM = '`viewpers.salesguard_alerts.email_messages_normalized`'

interface ThreadedMessageRow {
  message_id: string | null
  subject: string | null
  from: string | null
  to: string | null
  body: string | null
  date: string | null
  reply_level: number | string | null
  is_root: boolean | null
  source_file: string | null
  in_reply_to: string | null
  references: string | null
  message_key: string | null
}

interface ThreadIdRow {
  thread_id: string | null
  thread_id_norm: string | null
}

const bigquery = new BigQuery({ projectId: PROJECT_ID })

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const threadIdParam = searchParams.get('thread_id') || ''
    const modeParam = (searchParams.get('mode') || 'fast').toLowerCase() as 'fast' | 'full'
    const messageIdParam = searchParams.get('message_id') || ''
    const idParam = searchParams.get('id') || ''
    const start = searchParams.get('start') || ''
    const end = searchParams.get('end') || ''

    if (!threadIdParam && !messageIdParam && !idParam) {
      return NextResponse.json({ success: false, message: 'thread_id or message_id or id is required' }, { status: 400 })
    }

    if (!start || !end) {
      return NextResponse.json({ success: false, message: 'start and end query parameters are required' }, { status: 400 })
    }

    const startDate = new Date(start)
    const endDate = new Date(end)
    if (!Number.isFinite(startDate.valueOf()) || !Number.isFinite(endDate.valueOf())) {
      return NextResponse.json({ success: false, message: 'start and end must be valid ISO-8601 strings' }, { status: 400 })
    }
    if (startDate >= endDate) {
      return NextResponse.json({ success: false, message: 'start must be earlier than end' }, { status: 400 })
    }

    const rawLimit = parseInt(searchParams.get('limit') || (modeParam === 'fast' ? '100' : '300'), 10)
    const limit = Math.max(1, Math.min(Number.isFinite(rawLimit) ? rawLimit : modeParam === 'fast' ? 100 : 300, 500))

    const normaliseThread = (value: string) => value.replace(/^<|>$/g, '')

    let targetThreadId = threadIdParam
    let targetThreadIdNorm = threadIdParam ? normaliseThread(threadIdParam) : ''

    const baseParams: Record<string, string | number> = { start, end }

    if (!targetThreadId && (messageIdParam || idParam)) {
      const [threadRows] = await bigquery.query({
        query: `
          SELECT
            a.thread_id,
            a.thread_id_norm
          FROM ${ALERT_VIEW} a
          WHERE ((@message_id IS NOT NULL AND a.message_id = @message_id)
                 OR (@id IS NOT NULL AND a.id = @id))
            AND a.datetime >= TIMESTAMP(@start)
            AND a.datetime < TIMESTAMP(@end)
          LIMIT 1
        `,
        params: { ...baseParams, message_id: messageIdParam || null, id: idParam || null },
        useLegacySql: false,
        maximumBytesBilled: '20000000'
      })
      const row = (threadRows[0] as ThreadIdRow | undefined)
      targetThreadId = row?.thread_id || ''
      targetThreadIdNorm = row?.thread_id_norm || normaliseThread(targetThreadId)
    }

    const params = {
      ...baseParams,
      thread_id: targetThreadId,
      thread_id_norm: targetThreadIdNorm,
      message_id: messageIdParam || null,
      id: idParam || null,
    }

    const ensureThreadId = async () => {
      if (targetThreadId) return
      const [rows] = await bigquery.query({
        query: `
          SELECT
            a.message_id,
            a.description AS subject,
            a.person AS \`from\`,
            '' AS \`to\`,
            COALESCE(a.message_body, a.body_preview) AS body,
            a.datetime AS date,
            a.reply_level,
            a.is_root,
            a.source_file,
            CAST(NULL AS STRING) AS in_reply_to,
            CAST(NULL AS STRING) AS \`references\`,
            CONCAT(COALESCE(a.message_id, ''), '|', COALESCE(CAST(a.reply_level AS STRING), ''), '|', COALESCE(CAST(a.datetime AS STRING), '')) AS message_key
          FROM ${ALERT_VIEW} a
          WHERE ((@message_id IS NOT NULL AND a.message_id = @message_id)
                 OR (@id IS NOT NULL AND a.id = @id))
            AND a.datetime >= TIMESTAMP(@start)
            AND a.datetime < TIMESTAMP(@end)
          ORDER BY a.datetime ASC, a.reply_level ASC
          LIMIT ${limit}
        `,
        params,
        useLegacySql: false,
        maximumBytesBilled: '50000000'
      })

      const seen = new Set<string>()
      let uniqueCount = 0
      for (const row of rows as ThreadedMessageRow[]) {
        const key = row.message_key || ''
        if (!seen.has(key)) {
          seen.add(key)
          uniqueCount += 1
        }
      }

      const response = NextResponse.json({ success: true, messages: rows, totalCount: rows.length, returnedCount: rows.length, uniqueCount })
      response.headers.set('Cache-Control', 'public, max-age=120, s-maxage=120')
      response.headers.set('CDN-Cache-Control', 'public, max-age=120')
      response.headers.set('Vercel-CDN-Cache-Control', 'public, max-age=120')
      return response
    }

    if (!targetThreadId) {
      const fallbackResponse = await ensureThreadId()
      if (fallbackResponse) return fallbackResponse
    }

    const fastQuery = `
      SELECT
        a.message_id,
        a.description AS subject,
        a.person AS \`from\`,
        '' AS \`to\`,
        COALESCE(a.message_body, a.body_preview) AS body,
        a.datetime AS date,
        a.reply_level,
        a.is_root,
        a.source_file,
        CAST(NULL AS STRING) AS in_reply_to,
        CAST(NULL AS STRING) AS \`references\`,
        CONCAT(COALESCE(a.message_id, ''), '|', COALESCE(CAST(a.reply_level AS STRING), ''), '|', COALESCE(CAST(a.datetime AS STRING), '')) AS message_key
      FROM ${ALERT_VIEW} a
      WHERE (
        (@thread_id != '' AND a.thread_id = @thread_id)
        OR (@thread_id_norm != '' AND a.thread_id_norm = @thread_id_norm)
      )
        AND a.datetime >= TIMESTAMP(@start)
        AND a.datetime < TIMESTAMP(@end)
      ORDER BY a.datetime ASC, a.reply_level ASC
      LIMIT ${limit}
    `

    const fullQuery = `
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
        n.references AS \`references\`,
        CONCAT(COALESCE(m.message_id, ''), '|', COALESCE(CAST(m.reply_level AS STRING), ''), '|', COALESCE(CAST(m.date AS STRING), '')) AS message_key
      FROM ${MESSAGE_TABLE} m
      LEFT JOIN ${MESSAGE_NORM} n ON n.message_id = m.message_id
      WHERE (
        (@thread_id != '' AND SAFE_CAST(m.thread_id AS STRING) = @thread_id)
        OR (@thread_id_norm != '' AND REGEXP_REPLACE(SAFE_CAST(m.thread_id AS STRING), r'^<|>$', '') = @thread_id_norm)
      )
        AND SAFE_CAST(m.date AS TIMESTAMP) >= TIMESTAMP(@start)
        AND SAFE_CAST(m.date AS TIMESTAMP) < TIMESTAMP(@end)
      ORDER BY COALESCE(SAFE_CAST(m.date AS TIMESTAMP), TIMESTAMP('1970-01-01')) ASC, m.reply_level ASC
      LIMIT ${limit}
    `

    const query = modeParam === 'full' ? fullQuery : fastQuery
    try {
      const [dryRunJob] = await bigquery.createQueryJob({
        query,
        params,
        useLegacySql: false,
        dryRun: true,
      })
      const dryRunStats = dryRunJob.metadata?.statistics as { query?: { totalBytesProcessed?: string } } | undefined
      const estimatedBytes = dryRunStats?.query?.totalBytesProcessed
      console.info('threaded messages dry-run', { estimatedBytes, mode: modeParam, limit })
    } catch (err) {
      console.warn('threaded messages dry-run failed', err instanceof Error ? err.message : err)
    }

    const [messagesRows] = await bigquery.query({
      query,
      params,
      useLegacySql: false,
      maximumBytesBilled: modeParam === 'full' ? '2000000000' : '500000000'
    })

    const countQuery = `
      SELECT COUNT(*) AS totalCount
      FROM ${ALERT_VIEW} a
      WHERE (
        (@thread_id != '' AND a.thread_id = @thread_id)
        OR (@thread_id_norm != '' AND a.thread_id_norm = @thread_id_norm)
      )
        AND a.datetime >= TIMESTAMP(@start)
        AND a.datetime < TIMESTAMP(@end)
    `

    const [countRows] = await bigquery.query({
      query: countQuery,
      params,
      useLegacySql: false,
      maximumBytesBilled: '500000000'
    })

    const seen = new Set<string>()
    let uniqueCount = 0
    for (const row of messagesRows as ThreadedMessageRow[]) {
      const key = row.message_key || ''
      if (!seen.has(key)) {
        seen.add(key)
        uniqueCount += 1
      }
    }

    const totalCount = Number((countRows[0]?.totalCount as string | number | null) ?? messagesRows.length)

    const response = NextResponse.json({
      success: true,
      messages: messagesRows,
      totalCount,
      returnedCount: messagesRows.length,
      uniqueCount
    })
    response.headers.set('Cache-Control', 'public, max-age=120, s-maxage=120')
    response.headers.set('CDN-Cache-Control', 'public, max-age=120')
    response.headers.set('Vercel-CDN-Cache-Control', 'public, max-age=120')
    return response
  } catch (error) {
    console.error('Thread messages API error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      url: request.url,
    })
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : 'Failed to fetch messages' }, { status: 500 })
  }
}

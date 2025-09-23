import { NextRequest, NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const PROJECT_ID = 'viewpers'
const ALERT_VIEW = '`viewpers.salesguard_alerts.alerts_v2_compat_unified`'

interface AlertRow {
  id: string | null
  message_id: string | null
  status: string | null
  level: string | null
  score: number | string | null
  keyword: string | null
  department: string | null
  customer_email: string | null
  datetime: string
  person: string | null
  description: string | null
  messageBody?: string | null
  thread_id: string | null
  reply_level: number | string | null
  is_root: boolean | null
  source_file: string | null
  company_domain: string | null
  company_name: string | null
  detection_score: number | string | null
  assigned_user_id: string | null
  assignee_name: string | null
  customer_name_header: string | null
  customer_display_name: string | null
  sentiment_label: string | null
  sentiment_score: number | null
  negative_flag: boolean | null
  composite_risk: number | string | null
  seg_lose: boolean | null
  seg_rival: boolean | null
  seg_addreq: boolean | null
  seg_renewal: boolean | null
  thread_alert_count: number | string | null
  id_alert_count: number | string | null
}

interface SegmentCountsRow {
  lose: number | string | null
  rival: number | string | null
  addreq: number | string | null
  renewal: number | string | null
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const searchParams = url.searchParams

    const page = Math.max(parseInt(searchParams.get('page') || '1', 10) || 1, 1)
    const rawLimit = parseInt(searchParams.get('limit') || '20', 10)
    const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 20, 1), 100)
    const search = (searchParams.get('search') || '').trim().toLowerCase()
    const status = (searchParams.get('status') || '').trim()
    const level = (searchParams.get('level') || '').trim()
    const start = searchParams.get('start') || ''
    const end = searchParams.get('end') || ''
    const lightParam = (searchParams.get('light') || '1').toLowerCase()
    const light = lightParam !== '0' && lightParam !== 'false'

    if (!start || !end) {
      return NextResponse.json(
        { success: false, error: 'start and end query parameters are required and must be ISO-8601 strings' },
        { status: 400 }
      )
    }

    const startDate = new Date(start)
    const endDate = new Date(end)
    if (!Number.isFinite(startDate.valueOf()) || !Number.isFinite(endDate.valueOf())) {
      return NextResponse.json(
        { success: false, error: 'start and end must be valid ISO-8601 date strings' },
        { status: 400 }
      )
    }
    if (startDate >= endDate) {
      return NextResponse.json(
        { success: false, error: 'start must be earlier than end' },
        { status: 400 }
      )
    }

    const whereParts: string[] = [
      'a.datetime >= TIMESTAMP(@start)',
      'a.datetime < TIMESTAMP(@end)'
    ]
    const params: Record<string, string | number | boolean> = { start, end }

    if (search.length) {
      whereParts.push(`(\n        a.subject_norm LIKE @searchPrefix\n        OR a.person_norm LIKE @searchPrefix\n        OR a.customer_email_norm LIKE @searchPrefix\n        OR a.company_domain_norm LIKE @searchPrefix\n      )`)
      params.searchPrefix = `${search}%`
    }

    if (status) {
      whereParts.push('a.status = @status')
      params.status = status
    }

    if (level) {
      whereParts.push('a.level = @level')
      params.level = level
    }

    const whereClause = whereParts.join('\n        AND ')
    const offset = (page - 1) * limit

    const selectMessageBody = light ? 'NULL AS messageBody' : 'a.message_body AS messageBody'

    const query = `
      WITH Base AS (
        SELECT
          a.id,
          a.message_id,
          a.status,
          a.level,
          a.score,
          a.keyword,
          a.department,
          a.customer_email,
          a.datetime,
          a.person,
          a.description,
          ${selectMessageBody},
          a.thread_id,
          a.reply_level,
          a.is_root,
          a.source_file,
          a.company_domain,
          a.company_name,
          a.detection_score,
          a.assigned_user_id,
          a.assignee_name,
          a.customer_name_header,
          a.customer_display_name,
          a.sentiment_label,
          a.sentiment_score,
          a.negative_flag,
          a.composite_risk,
          a.seg_lose,
          a.seg_rival,
          a.seg_addreq,
          a.seg_renewal
        FROM ${ALERT_VIEW} a
        WHERE ${whereClause}
      ), ThreadCounts AS (
        SELECT thread_id, COUNT(*) AS thread_alert_count
        FROM Base
        WHERE thread_id IS NOT NULL
        GROUP BY thread_id
      ), Grouped AS (
        SELECT
          b.id,
          ANY_VALUE(b.person) AS person,
          ANY_VALUE(b.description) AS description,
          ANY_VALUE(b.messageBody) AS messageBody,
          ANY_VALUE(b.level) AS level,
          ANY_VALUE(b.status) AS status,
          MAX(b.datetime) AS datetime,
          ANY_VALUE(b.department) AS department,
          ANY_VALUE(b.customer_email) AS customer_email,
          (ARRAY_AGG(b.thread_id IGNORE NULLS LIMIT 1))[OFFSET(0)] AS thread_id,
          ANY_VALUE(b.reply_level) AS reply_level,
          ANY_VALUE(b.is_root) AS is_root,
          ANY_VALUE(b.source_file) AS source_file,
          ANY_VALUE(b.company_domain) AS company_domain,
          ANY_VALUE(b.company_name) AS company_name,
          ANY_VALUE(b.detection_score) AS detection_score,
          ANY_VALUE(b.assigned_user_id) AS assigned_user_id,
          ANY_VALUE(b.assignee_name) AS assignee_name,
          ANY_VALUE(b.keyword) AS keyword,
          ANY_VALUE(b.customer_name_header) AS customer_name_header,
          ANY_VALUE(b.customer_display_name) AS customer_display_name,
          COALESCE(ANY_VALUE(tc.thread_alert_count), 0) AS thread_alert_count,
          COUNT(*) AS id_alert_count,
          (ARRAY_AGG(b.message_id IGNORE NULLS LIMIT 1))[OFFSET(0)] AS message_id,
          ANY_VALUE(b.sentiment_label) AS sentiment_label,
          ANY_VALUE(b.sentiment_score) AS sentiment_score,
          ANY_VALUE(b.negative_flag) AS negative_flag,
          ANY_VALUE(b.composite_risk) AS composite_risk,
          ANY_VALUE(b.seg_lose) AS seg_lose,
          ANY_VALUE(b.seg_rival) AS seg_rival,
          ANY_VALUE(b.seg_addreq) AS seg_addreq,
          ANY_VALUE(b.seg_renewal) AS seg_renewal
        FROM Base b
        LEFT JOIN ThreadCounts tc ON tc.thread_id = b.thread_id
        GROUP BY b.id
      )
      SELECT *
      FROM Grouped
      ORDER BY datetime DESC
      LIMIT ${limit} OFFSET ${offset}
    `

    const bigquery = new BigQuery({ projectId: PROJECT_ID })
    try {
      const [dryRunJob] = await bigquery.createQueryJob({
        query,
        params,
        useLegacySql: false,
        dryRun: true,
      })
      const dryRunStats = dryRunJob.metadata?.statistics as { query?: { totalBytesProcessed?: string } } | undefined
      const estimatedBytes = dryRunStats?.query?.totalBytesProcessed
      console.info('alerts query dry-run', { estimatedBytes, page, limit, light })
    } catch (err) {
      console.warn('alerts dry-run failed', err instanceof Error ? err.message : err)
    }

    const [rowsRaw] = await bigquery.query({ query, params, useLegacySql: false, maximumBytesBilled: '3000000000' })
    const rows = rowsRaw as AlertRow[]

    const alerts = rows.map((row) => {
      const rawScore = typeof row.score === 'number' ? row.score : Number(row.score ?? 0)
      const rawDetection = typeof row.detection_score === 'number' ? row.detection_score : Number(row.detection_score ?? 0)
      const rawComposite = typeof row.composite_risk === 'number' ? row.composite_risk : Number(row.composite_risk ?? rawDetection)
      const sentimentScore = typeof row.sentiment_score === 'number' ? row.sentiment_score : null
      const threadCount = Number(row.thread_alert_count ?? 0)
      const idCount = Number(row.id_alert_count ?? 0)
      const phrases: string[] = typeof row.keyword === 'string' && row.keyword
        ? row.keyword.split(',').map((s: string) => s.trim()).filter(Boolean)
        : []
      const preferredCompany = row.company_name || row.company_domain || null
      const preferredCustomer = row.customer_name_header || row.customer_display_name || row.person || ''
      const assigneeName = row.assignee_name || row.assigned_user_id || undefined
      return {
        id: row.id,
        person: row.person || 'Unknown',
        description: row.description || 'No subject',
        messageBody: row.messageBody || (light ? undefined : 'No content'),
        level: row.level || 'medium',
        status: row.status || 'new',
        datetime: row.datetime,
        department: row.department || 'general',
        customerEmail: row.customer_email || '',
        quality: rawScore ? rawScore / 100 : 0.5,
        keyword: row.keyword || 'email',
        score: rawScore ? rawScore / 100 : 0.5,
        threadId: row.thread_id,
        replyLevel: row.reply_level,
        isRoot: row.is_root,
        sourceFile: row.source_file,
        company: preferredCompany,
        detection_score: rawComposite || rawDetection,
        assignee: assigneeName,
        phrases,
        customer_name: preferredCustomer,
        thread_count: threadCount,
        id_count: idCount,
        message_id: row.message_id,
        sentiment_label: row.sentiment_label || null,
        sentiment_score: sentimentScore,
        negative_flag: Boolean(row.negative_flag),
        segments: {
          lose: !!row.seg_lose,
          rival: !!row.seg_rival,
          addreq: !!row.seg_addreq,
          renewal: !!row.seg_renewal,
        },
        thread_id: row.thread_id,
        subject: row.description,
        body: row.messageBody,
        sender: row.person,
      }
    })

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM ${ALERT_VIEW} a
      WHERE ${whereClause}
    `
    const segmentCountQuery = `
      SELECT
        COUNTIF(a.seg_lose) AS lose,
        COUNTIF(a.seg_rival) AS rival,
        COUNTIF(a.seg_addreq) AS addreq,
        COUNTIF(a.seg_renewal) AS renewal
      FROM ${ALERT_VIEW} a
      WHERE ${whereClause}
    `

    const [[countRows], [segmentRows]] = await Promise.all([
      bigquery.query({ query: countQuery, params, useLegacySql: false, maximumBytesBilled: '1000000000' }),
      bigquery.query({ query: segmentCountQuery, params, useLegacySql: false, maximumBytesBilled: '1000000000' })
    ])

    const total = parseInt((countRows[0]?.total as string | number) || '0', 10)
    const countsRow = (segmentRows[0] as SegmentCountsRow | undefined) || { lose: 0, rival: 0, addreq: 0, renewal: 0 }
    const segmentCounts = {
      lose: Number(countsRow.lose ?? 0),
      rival: Number(countsRow.rival ?? 0),
      addreq: Number(countsRow.addreq ?? 0),
      renewal: Number(countsRow.renewal ?? 0),
    }
    const totalPages = Math.ceil(total / limit)

    const response = NextResponse.json({
      success: true,
      alerts,
      pagination: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
      searchInfo: search ? { query: search, results: alerts.length } : null,
      segmentCounts
    })

    response.headers.set('Cache-Control', 'public, max-age=60, s-maxage=60')
    response.headers.set('CDN-Cache-Control', 'public, max-age=60')
    response.headers.set('Vercel-CDN-Cache-Control', 'public, max-age=60')

    return response
  } catch (error) {
    console.error('❌ BigQuery API Error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
      searchParams: Object.fromEntries(request.nextUrl.searchParams),
      requestUrl: request.url,
    })

    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery({ projectId: 'viewpers' })

// App-side lightweight rules
const RULES: Array<{ kw: string; weight: number }> = [
  { kw: 'クレーム', weight: 1.0 },
  { kw: '苦情', weight: 1.0 },
  { kw: '不満', weight: 1.0 },
  { kw: '緊急', weight: 1.5 },
  { kw: '至急', weight: 1.5 },
  { kw: '急ぎ', weight: 1.5 },
  { kw: 'キャンセル', weight: 1.2 },
  { kw: '解約', weight: 1.2 },
  { kw: '高い', weight: 0.8 },
  { kw: '料金', weight: 0.8 },
  { kw: '価格', weight: 0.8 },
  { kw: '不良', weight: 1.3 },
  { kw: '不具合', weight: 1.3 },
  { kw: '故障', weight: 1.3 },
  { kw: 'まだですか', weight: 1.1 },
  { kw: '対応して', weight: 1.1 },
  { kw: '返事がない', weight: 1.1 },
]

function computeScoreAndKeywords(text: string) {
  let score = 0
  const hits: string[] = []
  for (const { kw, weight } of RULES) {
    if (text.includes(kw)) {
      score += weight
      hits.push(kw)
    }
  }
  return { score, keyword: hits.join(', ') }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const priority = (searchParams.get('priority') || '').toLowerCase()

    const offset = (page - 1) * limit

    // Optional server-side filter by priority level
    const whereClause = priority === 'high' || priority === 'medium' || priority === 'low'
      ? `WHERE level = '${priority}'`
      : ''

    // Read directly from the pre-scored BigQuery table
    const query = `
      SELECT
        id, original_alert_id, message_id, status, level, score, keyword,
        department, assigned_user_id, customer_email, datetime, updated_at,
        resolved_at, resolved_by, resolution_note, person, description, messageBody,
        source_file, thread_id, reply_level, is_root
      FROM \`viewpers.salesguard_alerts.alerts_v2_scored\`
      ${whereClause}
      ORDER BY datetime DESC
      LIMIT ${limit} OFFSET ${offset}
    `

    const countQuery = `
      SELECT COUNT(*) AS total FROM \`viewpers.salesguard_alerts.alerts_v2_scored\`
      ${whereClause}
    `

    const [rowsResult, countResult] = await Promise.all([
      bigquery.query({ query, useLegacySql: false, maximumBytesBilled: '20000000000' }),
      bigquery.query({ query: countQuery, useLegacySql: false, maximumBytesBilled: '20000000000' })
    ])

    const rows = rowsResult[0] || []
    const countRows = countResult[0] || []

    const total = countRows[0]?.total || 0
    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      success: true,
      alerts: rows,
      pagination: {
        page,
        limit,
        offset,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
      searchInfo: null,
    }, {
      headers: {
        'Cache-Control': 'public, max-age=120, s-maxage=120',
        'ETag': `"${Date.now()}"`,
        'Last-Modified': new Date().toUTCString(),
      }
    })
  } catch (error: any) {
    console.error('Error fetching alerts:', error)
    return NextResponse.json({
      success: false,
      message: error.message || 'アラートの取得に失敗しました',
      error: error.message,
    }, { status: 500 })
  }
} 
import { NextRequest, NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const level = searchParams.get('level') || ''
    const priority = searchParams.get('priority') || ''

    const offset = (page - 1) * limit

    // BigQueryクライアント初期化（gcloud認証を使用）
    const bigquery = new BigQuery({
      projectId: 'viewpers'
    })

    // 新しいテーブル構造を使用
    let query = `
      SELECT 
        a.alert_id as id,
        a.message_id,
        a.status,
        a.priority as level,
        a.score,
        a.detected_keyword as keyword,
        a.department,
        a.customer_email,
        a.date as datetime,
        -- メール情報も取得
        a.\`from\` as person,
        a.subject as description,
        a.body as messageBody,
        a.thread_id,
        a.reply_level,
        a.is_root,
        a.source_file
      FROM \`viewpers.salesguard_alerts.alerts_clean_v7_dedup\` a
      WHERE 1=1
    `

    const queryParams: any[] = []
    let paramIndex = 0

    // 検索条件の追加
    if (search) {
      query += ` AND (
        a.\`from\` LIKE @param${paramIndex} OR
        a.subject LIKE @param${paramIndex} OR
        a.body LIKE @param${paramIndex} OR
        a.customer_email LIKE @param${paramIndex}
      )`
      queryParams.push({ name: `param${paramIndex}`, value: `%${search}%` })
      paramIndex++
    }

    if (status) {
      query += ` AND a.status = @param${paramIndex}`
      queryParams.push({ name: `param${paramIndex}`, value: status })
      paramIndex++
    }

    if (level) {
      query += ` AND a.priority = @param${paramIndex}`
      queryParams.push({ name: `param${paramIndex}`, value: level })
      paramIndex++
    }

    if (priority) {
      query += ` AND a.priority = @param${paramIndex}`
      queryParams.push({ name: `param${paramIndex}`, value: priority })
      paramIndex++
    }

    query += ` ORDER BY a.date DESC LIMIT ${limit} OFFSET ${offset}`

    const [rows] = await bigquery.query({ 
      query,
      params: queryParams
    })

    // レスポンスデータの整形
    const alerts = rows.map((row: any) => ({
      id: row.id,
      person: row.person || 'Unknown',
      description: row.description || 'No subject',
      messageBody: row.messageBody || 'No content',
      level: row.level || 'medium',
      status: row.status || 'new',
      datetime: row.datetime,
      department: row.department || 'general',
      customerEmail: row.customer_email || '',
      quality: row.score ? row.score / 100 : 0.5,
      keyword: row.keyword || 'email',
      score: row.score ? row.score / 100 : 0.5,
      threadId: row.thread_id,
      replyLevel: row.reply_level,
      isRoot: row.is_root,
      sourceFile: row.source_file,
      // 追加フィールド
      messageId: row.message_id
    }))

    // 総件数取得
    const countQuery = `
      SELECT COUNT(*) as total
      FROM \`viewpers.salesguard_alerts.alerts_clean_v7_dedup\` a
      WHERE 1=1
      ${search ? `AND (
        a.\`from\` LIKE '%${search}%' OR
        a.subject LIKE '%${search}%' OR
        a.body LIKE '%${search}%' OR
        a.customer_email LIKE '%${search}%'
      )` : ''}
      ${status ? `AND a.status = '${status}'` : ''}
      ${level ? `AND a.priority = '${level}'` : ''}
      ${priority ? `AND a.priority = '${priority}'` : ''}
    `

    const [countResult] = await bigquery.query({ query: countQuery })
    const total = parseInt(countResult[0].total)
    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      success: true,
      alerts,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      searchInfo: search ? {
        query: search,
        results: alerts.length
      } : null
    })

  } catch (error) {
    console.error('❌ BigQuery API Error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
      requestUrl: request.url,
      searchParams: Object.fromEntries(request.nextUrl.searchParams)
    })

    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        requestUrl: request.url,
        searchParams: Object.fromEntries(request.nextUrl.searchParams)
      },
      { status: 500 }
    )
  }
} 
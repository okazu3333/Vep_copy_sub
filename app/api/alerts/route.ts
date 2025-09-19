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
    const start = searchParams.get('start') || ''
    const end = searchParams.get('end') || ''

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
        a.datetime as datetime,
        -- メール情報も取得
        a.\`from\` as person,
        a.subject as description,
        a.body as messageBody,
        a.thread_id,
        a.reply_level,
        a.is_root,
        a.source_file
      FROM \`viewpers.salesguard_alerts.alerts_v2_compat_v7\` a
      WHERE 1=1
    `

    const params: Record<string, any> = {}

    // 検索条件の追加
    if (search) {
      query += ` AND (
        a.\`from\` LIKE @search OR
        a.subject LIKE @search OR
        a.body LIKE @search OR
        a.customer_email LIKE @search
      )`
      params.search = `%${search}%`
    }

    if (status) {
      query += ` AND a.status = @status`
      params.status = status
    }

    if (level) {
      query += ` AND a.priority = @level`
      params.level = level
    }

    if (priority) {
      query += ` AND a.priority = @priority`
      params.priority = priority
    }

    if (start) {
      query += ` AND a.datetime >= TIMESTAMP(@start)`
      params.start = start
    }

    if (end) {
      query += ` AND a.datetime < TIMESTAMP(@end)`
      params.end = end
    }

    query += ` ORDER BY a.datetime DESC LIMIT ${limit} OFFSET ${offset}`

    const [rows] = await bigquery.query({ 
      query,
      params,
      useLegacySql: false,
      maximumBytesBilled: '20000000000'
    })

    // レスポンスデータの整形（UI互換のエイリアスも同梱）
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
      messageId: row.message_id,
      // 互換エイリアス（フロントの参照崩れ対策）
      thread_id: row.thread_id,
      subject: row.description,
      body: row.messageBody,
      sender: row.person,
    }))

    // 総件数取得（同一フィルタ適用）
    let countQuery = `
      SELECT COUNT(*) as total
      FROM \`viewpers.salesguard_alerts.alerts_v2_compat_v7\` a
      WHERE 1=1
    `
    if (search) {
      countQuery += ` AND (
        a.\`from\` LIKE @search OR
        a.subject LIKE @search OR
        a.body LIKE @search OR
        a.customer_email LIKE @search
      )`
    }
    if (status) countQuery += ` AND a.status = @status`
    if (level) countQuery += ` AND a.priority = @level`
    if (priority) countQuery += ` AND a.priority = @priority`
    if (start) countQuery += ` AND a.datetime >= TIMESTAMP(@start)`
    if (end) countQuery += ` AND a.datetime < TIMESTAMP(@end)`

    const [countResult] = await bigquery.query({ query: countQuery, params, useLegacySql: false, maximumBytesBilled: '20000000000' })
    const total = parseInt(countResult[0].total)
    const totalPages = Math.ceil(total / limit)

    const response = NextResponse.json({
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

    response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=300')
    response.headers.set('CDN-Cache-Control', 'public, max-age=300')
    response.headers.set('Vercel-CDN-Cache-Control', 'public, max-age=300')

    return response

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
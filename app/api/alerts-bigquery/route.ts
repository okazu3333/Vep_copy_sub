import { NextRequest } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'
import { NextResponse } from 'next/server'

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
        a.status,
        a.priority as level,
        a.score,
        a.detected_keyword as keyword,
        a.department,
        a.assigned_user_id,
        a.customer_email as customerEmail,
        a.created_at as datetime,
        a.updated_at,
        a.resolved_at,
        a.resolved_by,
        a.resolution_note,
        -- メール情報も取得
        e.\`from\` as person,
        e.subject as description,
        e.body as messageBody,
        e.thread_id,
        e.reply_level,
        e.is_root,
        e.source_file
      FROM \`viewpers.salesguard_alerts.alerts\` a
      LEFT JOIN \`viewpers.salesguard_alerts.email_messages\` e ON a.message_id = e.message_id
      WHERE 1=1
    `

    // 検索条件の追加
    if (search) {
      query += ` AND (
        e.\`from\` LIKE '%${search}%' OR
        e.subject LIKE '%${search}%' OR
        e.body LIKE '%${search}%' OR
        a.detected_keyword LIKE '%${search}%'
      )`
    }

    if (status) {
      query += ` AND a.status = '${status}'`
    }

    if (level) {
      query += ` AND a.priority = '${level}'`
    }

    if (priority) {
      query += ` AND a.priority = '${priority}'`
    }

    query += ` ORDER BY a.created_at DESC LIMIT ${limit} OFFSET ${offset}`
    
    const [rows] = await bigquery.query({ 
      query
    })
    
    // レスポンスデータの整形
    const processedRows = rows.map((row: any) => ({
      ...row,
      datetime: row.datetime ? new Date(row.datetime).toISOString() : null,
      messageBody: row.messageBody && row.messageBody !== 'メッセージ内容なし' 
        ? row.messageBody.substring(0, 500) + (row.messageBody.length > 500 ? '...' : '')
        : row.messageBody,
      // フロントエンド互換性のためのフィールド追加
      keyword: row.keyword || 'キーワードなし',
      level: (row.level || 'medium').toLowerCase(),
      status: row.status === 'new' ? 'pending' : row.status,
      score: Math.round((row.score || 0) * 100) / 100
    }))

    // 総件数を取得
    const countQuery = `
      SELECT COUNT(*) as total
      FROM \`viewpers.salesguard_alerts.alerts\` a
      LEFT JOIN \`viewpers.salesguard_alerts.email_messages\` e ON a.message_id = e.message_id
      WHERE 1=1
      ${search ? `AND (
        e.\`from\` LIKE '%${search}%' OR
        e.subject LIKE '%${search}%' OR
        e.body LIKE '%${search}%' OR
        a.detected_keyword LIKE '%${search}%'
      )` : ''}
      ${status ? `AND a.status = '${status}'` : ''}
      ${level ? `AND a.priority = '${level}'` : ''}
      ${priority ? `AND a.priority = '${priority}'` : ''}
    `
    
    const [countRows] = await bigquery.query({
      query: countQuery
    })
    
    const total = countRows[0]?.total || 0
    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      success: true,
      alerts: processedRows,
      source: 'bigquery-alerts',
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    })

  } catch (error: any) {
    console.error('BigQuery API Error:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch alerts',
      details: error.message
    }, { status: 500 })
  }
} 
import { NextRequest, NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')
    const department = searchParams.get('department')

    // BigQueryクライアントの初期化
    const bigquery = new BigQuery({
      projectId: 'viewpers'
    })

    // WHERE句の構築（パフォーマンス最適化）
    let whereClause = ''
    const conditions = []

    if (status) {
      conditions.push(`a.status = '${status}'`)
    }
    if (priority) {
      conditions.push(`a.priority = '${priority}'`)
    }
    if (department) {
      conditions.push(`a.department = '${department}'`)
    }

    if (conditions.length > 0) {
      whereClause = `WHERE ${conditions.join(' AND ')}`
    }

    // 超高速クエリ（パーティショニングとインデックスを活用）
    const query = `
      SELECT
        a.alert_id as id,
        a.message_id,
        a.status,
        a.priority as level,
        a.score,
        a.detected_keyword as keyword,
        a.department,
        a.assigned_user_id,
        a.customer_email,
        a.created_at as datetime,
        a.updated_at,
        a.resolved_at,
        a.resolved_by,
        a.resolution_note,
        -- メール情報も取得（必要なフィールドのみ）
        e.\`from\` as person,
        e.subject as description,
        e.body as messageBody,
        e.thread_id,
        e.reply_level,
        e.is_root,
        e.source_file
      FROM \`viewpers.salesguard_alerts.alerts\` a
      LEFT JOIN \`viewpers.salesguard_alerts.email_messages\` e ON a.message_id = e.message_id
      ${whereClause}
      ORDER BY a.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `

    console.log('BigQueryクエリ実行開始...')
    const startTime = Date.now()
    
    // クエリオプションの最適化
    const queryOptions = {
      query,
      useLegacySql: false,
      maximumBytesBilled: '1000000000', // 1GB制限
      useQueryCache: true // クエリキャッシュを有効化
    }
    
    const [rows] = await bigquery.query(queryOptions)
    
    const queryTime = Date.now() - startTime
    console.log(`BigQueryクエリ完了: ${queryTime}ms`)

    // レスポンスデータの構築
    const alerts = rows.map((row: any) => ({
      id: row.id,
      messageId: row.message_id,
      status: row.status,
      level: row.level,
      score: row.score,
      keyword: row.keyword,
      department: row.department,
      assignedUserId: row.assigned_user_id,
      customerEmail: row.customer_email,
      datetime: row.datetime,
      updatedAt: row.updated_at,
      resolvedAt: row.resolved_at,
      resolvedBy: row.resolved_by,
      resolutionNote: row.resolution_note,
      person: row.person,
      description: row.description,
      messageBody: row.messageBody,
      threadId: row.thread_id,
      replyLevel: row.reply_level,
      isRoot: row.is_root,
      sourceFile: row.source_file,
      quality: row.score ? Math.min(row.score / 100, 1) : 0.5
    }))

    // 総件数を取得（軽量クエリ、キャッシュを活用）
    const countQuery = `
      SELECT COUNT(*) as total
      FROM \`viewpers.salesguard_alerts.alerts\` a
      ${whereClause}
    `
    
    const [countRows] = await bigquery.query({
      query: countQuery,
      useQueryCache: true,
      maximumBytesBilled: '100000000'
    })
    const total = countRows[0]?.total || 0

    // レスポンスの作成
    const response = NextResponse.json({
      success: true,
      data: alerts,
      pagination: {
        limit,
        offset,
        total
      },
      performance: {
        queryTime: `${queryTime}ms`,
        totalRecords: alerts.length,
        cacheHit: queryTime < 1000 ? 'likely' : 'miss'
      }
    })

    // キャッシュヘッダーの設定（より積極的なキャッシュ）
    response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120')
    response.headers.set('ETag', `"${Date.now()}-${total}-${queryTime}"`)
    response.headers.set('Last-Modified', new Date().toUTCString())
    response.headers.set('X-Query-Time', queryTime.toString())

    return response

  } catch (error: any) {
    console.error('アラート取得エラー:', error)
    
    return NextResponse.json({
      success: false,
      message: 'アラートの取得に失敗しました',
      error: error.message
    }, { status: 500 })
  }
} 
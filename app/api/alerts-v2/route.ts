import { NextRequest, NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery({ projectId: 'viewpers' })

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const priority = searchParams.get('priority') || ''
    const department = searchParams.get('department') || ''
    
    const offset = (page - 1) * limit
    
    // WHERE句の構築
    let whereConditions = ['1=1']
    let queryParams: any[] = []
    
    if (search) {
      whereConditions.push(`(LOWER(sender) LIKE LOWER(@search) OR LOWER(subject) LIKE LOWER(@search) OR LOWER(body) LIKE LOWER(@search))`)
      queryParams.push({ name: 'search', value: `%${search}%` })
    }
    
    if (status && status !== 'all') {
      whereConditions.push(`status = @status`)
      queryParams.push({ name: 'status', value: status })
    }
    
    if (priority && priority !== 'all') {
      whereConditions.push(`priority = @priority`)
      queryParams.push({ name: 'priority', value: priority })
    }
    
    if (department && department !== 'all') {
      whereConditions.push(`department = @department`)
      queryParams.push({ name: 'department', value: department })
    }
    
    const whereClause = whereConditions.join(' AND ')
    
    // メインクエリ
    const query = `
      SELECT
        alert_id as id,
        original_alert_id,
        message_id,
        status,
        priority as level,
        score,
        detected_keyword as keyword,
        department,
        assigned_user_id,
        customer_email,
        created_at as datetime,
        updated_at,
        resolved_at,
        resolved_by,
        resolution_note,
        sender as person,
        subject as description,
        body as messageBody,
        source_file,
        thread_id,
        reply_level,
        is_root
      FROM \`viewpers.salesguard_alerts.alerts_v2\`
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `
    
    // 総件数クエリ
    const countQuery = `
      SELECT COUNT(*) as total
      FROM \`viewpers.salesguard_alerts.alerts_v2\`
      WHERE ${whereClause}
    `
    
    // クエリ実行
    const [rows] = await bigquery.query({
      query,
      params: queryParams,
      useLegacySql: false,
      maximumBytesBilled: '1000000000' // 1GB
    })
    
    const [countRows] = await bigquery.query({
      query: countQuery,
      params: queryParams,
      useLegacySql: false,
      maximumBytesBilled: '1000000000'
    })
    
    const total = countRows[0]?.total || 0
    const totalPages = Math.ceil(total / limit)
    
    // レスポンスデータの構築
    const alerts = rows.map((row: any) => ({
      ...row,
      // 日付フォーマットの統一
      datetime: row.datetime ? new Date(row.datetime.value || row.datetime).toISOString() : null,
      // レベルの正規化
      level: row.level?.toLowerCase() || 'medium',
      // ステータスの日本語化
      status: row.status || 'pending'
    }))
    
    return NextResponse.json({
      success: true,
      alerts,
      pagination: {
        page,
        limit,
        offset,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      searchInfo: search ? {
        searchTerm: search,
        resultsCount: alerts.length,
        totalResults: total
      } : null
    }, {
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=300',
        'ETag': `"${Date.now()}"`,
        'Last-Modified': new Date().toUTCString(),
        'X-Query-Time': Date.now().toString()
      }
    })
    
  } catch (error: any) {
    console.error('Error fetching alerts:', error)
    return NextResponse.json({
      success: false,
      message: error.message || 'アラートの取得に失敗しました',
      error: error.message
    }, { status: 500 })
  }
} 
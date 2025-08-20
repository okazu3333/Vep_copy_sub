import { NextRequest, NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

// gcloud認証を使用
const bigquery = new BigQuery({ projectId: 'viewpers' })

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const offset = (page - 1) * limit
    const search = searchParams.get('search')
    const status = searchParams.get('status')
    const level = searchParams.get('level')
    
    // 検索条件の構築
    let whereConditions = []
    let queryParams = []
    let paramIndex = 1
    
    if (search) {
      whereConditions.push(`(
        \`from\` LIKE $${paramIndex} OR
        subject LIKE $${paramIndex} OR
        body LIKE $${paramIndex} OR
        \`to\` LIKE $${paramIndex}
      )`)
      queryParams.push(`%${search}%`)
      paramIndex++
    }
    
    if (status && status !== 'all') {
      whereConditions.push(`'new' = $${paramIndex}`)  // 現在は全て'new'ステータス
      queryParams.push(status)
      paramIndex++
    }
    
    if (level && level !== 'all') {
      whereConditions.push(`'medium' = $${paramIndex}`)  // 現在は全て'medium'優先度
      queryParams.push(level)
      paramIndex++
    }
    
    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}`
      : ''
    
    const query = `
      SELECT 
        message_id as id,
        \`from\` as person,
        subject as description,
        body as messageBody,
        'medium' as level,
        'new' as status,
        created_at as datetime,
        'general' as department,
        \`to\` as customerEmail,
        1.0 as quality,
        'email' as keyword,
        0.5 as score,
        thread_id,
        reply_level,
        is_root,
        source_file
      FROM \`viewpers.salesguard_alerts.email_messages\`
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `
    
    const [rows] = await bigquery.query({ 
      query,
      params: queryParams
    })
    
    // 総件数取得
    const countQuery = `
      SELECT COUNT(*) as total
      FROM \`viewpers.salesguard_alerts.email_messages\`
      ${whereClause}
    `
    
    const [countResult] = await bigquery.query({ 
      query: countQuery,
      params: queryParams
    })
    
    const total = parseInt(countResult[0].total)
    const totalPages = Math.ceil(total / limit)
    
    return NextResponse.json({
      success: true,
      alerts: rows,
      source: 'bigquery-current',
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
        results: rows.length
      } : null
    })
    
  } catch (error) {
    console.error('Error fetching alerts:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch alerts',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 
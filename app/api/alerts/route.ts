import { NextRequest, NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery({ projectId: 'viewpers' })

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Parameters
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const severity = searchParams.get('severity') || ''
    const department = searchParams.get('department') || ''
    const light = searchParams.get('light') === '1'
    
    // Remove date filtering since data is fixed to 2025/7/7-7/14
    // const start = searchParams.get('start')
    // const end = searchParams.get('end')

    const whereParts: string[] = [
      // Only show actual risk messages
      'primary_risk_type != \'low\''
    ]
    const params: Record<string, string | number | boolean> = {}

    if (search.length) {
      whereParts.push(`(
        subject LIKE @searchPrefix
        OR \`from\` LIKE @searchPrefix
        OR company_domain LIKE @searchPrefix
      )`)
      params.searchPrefix = `%${search}%`
    }

    if (status) {
      whereParts.push('primary_risk_type = @status')
      params.status = status
    }

    if (severity) {
      whereParts.push('primary_risk_type = @severity')
      params.severity = severity
    }

    if (department) {
      whereParts.push('company_domain LIKE @department')
      params.department = `%${department}%`
    }

    const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : ''
    const offset = (page - 1) * limit

    // Build the main query with NLP-based segment detection
    const baseQuery = `
      WITH SegmentDetection AS (
        SELECT
          message_id,
          thread_id,
          subject,
          subject as email_subject,
          body_preview,
          \`from\`,
          \`to\`,
          datetime,
          company_domain,
          direction,
          primary_risk_type,
          risk_keywords,
          score,
          sentiment_label,
          sentiment_score,
          negative_flag,
          reply_level,
          is_root,
          source_uri,
          
          -- NLP + キーワードベースセグメント検知
          -- 失注・解約セグメント (最優先)
          CASE 
            WHEN (
              sentiment_label = 'negative' 
              AND sentiment_score < -0.3
              AND REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), 
                r'(解約|キャンセル|中止|やめ|辞め|終了|停止|見送り|断念|解除|取り消し)')
            ) OR (
              negative_flag = true
              AND REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), 
                r'(解約|キャンセル|中止|やめ|辞め|終了|停止|見送り|断念)')
            ) OR (
              REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), 
                r'(解約.*決定|キャンセル.*確定|契約.*終了|サービス.*停止)')
            )
            THEN true 
            ELSE false 
          END as seg_lose,
          
          -- 競合比較セグメント
          CASE 
            WHEN (
              sentiment_label IN ('neutral', 'negative')
              AND REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), 
                r'(競合|他社|比較|検討|相見積|vs|対抗|選定|評価|ベンダー)')
            ) OR (
              REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), 
                r'(他社.*提案|競合.*比較|価格.*比較|機能.*比較)')
            )
            THEN true 
            ELSE false 
          END as seg_rival,
          
          -- 追加要望セグメント
          CASE 
            WHEN (
              sentiment_label IN ('neutral', 'positive')
              AND REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), 
                r'(追加|オプション|機能|要望|改善|拡張|カスタマイズ|新機能|アップグレード)')
            ) OR (
              REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), 
                r'(機能.*追加|オプション.*検討|カスタマイズ.*希望)')
            )
            THEN true 
            ELSE false 
          END as seg_addreq,
          
          -- 更新・継続セグメント
          CASE 
            WHEN (
              sentiment_label IN ('neutral', 'positive')
              AND REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), 
                r'(更新|継続|契約|延長|リニューアル|再契約|期限|満了)')
            ) OR (
              REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), 
                r'(契約.*更新|サービス.*継続|ライセンス.*延長)')
            )
            THEN true 
            ELSE false 
          END as seg_renewal
          
        FROM \`viewpers.salesguard_alerts.unified_email_messages\`
        ${whereClause}
      )
      SELECT *
      FROM SegmentDetection
      ORDER BY score DESC, datetime DESC
      LIMIT @limit OFFSET @offset
    `

    params.limit = limit
    params.offset = offset

    // Execute main query
    const [rows] = await bigquery.query({
      query: baseQuery,
      params,
      useLegacySql: false,
      location: 'asia-northeast1',
      maximumBytesBilled: '20000000000' // 20GB limit
    })

    // Count query
    const countQuery = `
      SELECT COUNT(*) as total
      FROM \`viewpers.salesguard_alerts.unified_email_messages\`
      ${whereClause}
    `

    const [countRows] = await bigquery.query({
      query: countQuery,
      params,
      useLegacySql: false,
      location: 'asia-northeast1',
      maximumBytesBilled: '5000000000' // 5GB limit
    })

    const total = countRows[0]?.total || 0

    // Segment counts query (全データに対して実行)
    const segmentCountQuery = `
      WITH SegmentDetection AS (
        SELECT
          -- 失注・解約セグメント
          CASE 
            WHEN (
              sentiment_label = 'negative' 
              AND sentiment_score < -0.3
              AND REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), 
                r'(解約|キャンセル|中止|やめ|辞め|終了|停止|見送り|断念|解除|取り消し)')
            ) OR (
              negative_flag = true
              AND REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), 
                r'(解約|キャンセル|中止|やめ|辞め|終了|停止|見送り|断念)')
            ) OR (
              REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), 
                r'(解約.*決定|キャンセル.*確定|契約.*終了|サービス.*停止)')
            )
            THEN true 
            ELSE false 
          END as seg_lose,
          
          -- 競合比較セグメント
          CASE 
            WHEN (
              sentiment_label IN ('neutral', 'negative')
              AND REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), 
                r'(競合|他社|比較|検討|相見積|vs|対抗|選定|評価|ベンダー)')
            ) OR (
              REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), 
                r'(他社.*提案|競合.*比較|価格.*比較|機能.*比較)')
            )
            THEN true 
            ELSE false 
          END as seg_rival,
          
          -- 追加要望セグメント
          CASE 
            WHEN (
              sentiment_label IN ('neutral', 'positive')
              AND REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), 
                r'(追加|オプション|機能|要望|改善|拡張|カスタマイズ|新機能|アップグレード)')
            ) OR (
              REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), 
                r'(機能.*追加|オプション.*検討|カスタマイズ.*希望)')
            )
            THEN true 
            ELSE false 
          END as seg_addreq,
          
          -- 更新・継続セグメント
          CASE 
            WHEN (
              sentiment_label IN ('neutral', 'positive')
              AND REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), 
                r'(更新|継続|契約|延長|リニューアル|再契約|期限|満了)')
            ) OR (
              REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), 
                r'(契約.*更新|サービス.*継続|ライセンス.*延長)')
            )
            THEN true 
            ELSE false 
          END as seg_renewal
          
        FROM \`viewpers.salesguard_alerts.unified_email_messages\`
        WHERE primary_risk_type != 'low'
      )
      SELECT 
        COUNT(CASE WHEN seg_lose = true THEN 1 END) as lose_count,
        COUNT(CASE WHEN seg_rival = true THEN 1 END) as rival_count,
        COUNT(CASE WHEN seg_addreq = true THEN 1 END) as addreq_count,
        COUNT(CASE WHEN seg_renewal = true THEN 1 END) as renewal_count
      FROM SegmentDetection
    `

    const [segmentCountRows] = await bigquery.query({
      query: segmentCountQuery,
      useLegacySql: false,
      location: 'asia-northeast1',
      maximumBytesBilled: '10000000000' // 10GB limit
    })

    const segmentCounts = segmentCountRows[0] || {}

    // Transform results
    const alerts = rows.map((row: any) => ({
      id: row.message_id || row.id,
      messageId: row.message_id,
      threadId: row.thread_id,
      subject: row.subject || '',
      customer: row.from || '',
      customerEmail: row.from || '',
      department: row.company_domain || '',
      status: 'unhandled', // Default status
      severity: row.primary_risk_type || 'medium',
      phrases: row.risk_keywords || '',
      datetime: row.datetime?.value || row.datetime,
      updatedAt: row.datetime?.value || row.datetime,
      aiSummary: row.body_preview || '',
      companyDomain: row.company_domain || '',
      replyLevel: row.reply_level || 0,
      isRoot: row.is_root || false,
      sourceFile: row.source_uri || '',
      sentimentLabel: row.sentiment_label,
      sentimentScore: row.sentiment_score,
      negativeFlag: row.negative_flag,
      segments: {
        lose: row.seg_lose || false,
        rival: row.seg_rival || false,
        addreq: row.seg_addreq || false,
        renewal: row.seg_renewal || false
      }
    }))

    const response = NextResponse.json({
      success: true,
      alerts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      segmentCounts: {
        lose: segmentCounts.lose_count || 0,
        rival: segmentCounts.rival_count || 0,
        addreq: segmentCounts.addreq_count || 0,
        renewal: segmentCounts.renewal_count || 0
      }
    })

    // Set cache headers
    response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=300') // 5 minutes cache
    response.headers.set('CDN-Cache-Control', 'public, max-age=300')
    response.headers.set('Vercel-CDN-Cache-Control', 'public, max-age=300')
    
    // Add diagnostic headers
    response.headers.set('X-App-Instance', process.env.VERCEL_DEPLOYMENT_ID || 'local')
    response.headers.set('X-BQ-Project', 'viewpers')
    response.headers.set('X-Route', 'alerts-unified-nlp')

    return response

  } catch (error: any) {
    console.error('Alerts API error:', { message: error?.message, url: request?.url })
    return NextResponse.json({ 
      success: false, 
      message: error.message || 'Failed to fetch alerts',
      alerts: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      segmentCounts: { lose: 0, rival: 0, addreq: 0, renewal: 0 }
    }, { status: 500 })
  }
}

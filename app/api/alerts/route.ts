import { NextRequest, NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

import { INTERNAL_EMAIL_DOMAINS } from '@/lib/constants/internal-domains'

const bigquery = new BigQuery({ projectId: 'viewpers' })

type SeverityFilter = 'high' | 'medium' | 'low' | 'very_low'

const SEVERITY_BOUNDS: Record<SeverityFilter, { min?: number; max?: number }> = {
  high: { min: 80 },
  medium: { min: 50, max: 79.999 },
  low: { min: 30, max: 49.999 },
  very_low: { max: 29.999 }
}

function buildSeverityClause(severity: string | null, params: Record<string, unknown>) {
  if (!severity) return ''

  const bounds = SEVERITY_BOUNDS[severity as SeverityFilter]
  if (!bounds) return ''

  if (typeof bounds.min === 'number') {
    params.severityMin = bounds.min
  }
  if (typeof bounds.max === 'number') {
    params.severityMax = bounds.max
  }

  const clauses: string[] = []
  if (typeof bounds.min === 'number') {
    clauses.push('calculated_urgency_score >= @severityMin')
  }
  if (typeof bounds.max === 'number') {
    clauses.push('calculated_urgency_score <= @severityMax')
  }

  return clauses.length ? `\n  AND ${clauses.join(' AND ')}` : ''
}

function scoreToSeverity(score: number): 'A' | 'B' | 'C' {
  if (score >= 80) return 'A'
  if (score >= 50) return 'B'
  return 'C'
}

function extractDomainAddress(raw: string | null | undefined): string | null {
  if (!raw) return null
  const match = raw.match(/<([^>]+)>/) || [null, raw]
  const email = match[1] || match[0]
  if (!email || !email.includes('@')) return null
  return email.toLowerCase()
}

function determineAssignee(fromField: string, toField: string, direction: string): string | null {
  const candidateEmails: string[] = []

  if (direction === 'inbound' && toField) {
    candidateEmails.push(
      ...toField
        .split(',')
        .map(part => extractDomainAddress(part.trim()))
        .filter((email): email is string => Boolean(email))
    )
  } else if (direction === 'outbound' && fromField) {
    const email = extractDomainAddress(fromField)
    if (email) candidateEmails.push(email)
  }

  if (!candidateEmails.length) {
    candidateEmails.push(...[fromField, toField].flatMap(value => {
      if (!value) return [] as string[]
      return value
        .split(',')
        .map(part => extractDomainAddress(part.trim()))
        .filter((email): email is string => Boolean(email))
    }))
  }

  return (
    candidateEmails.find(email => INTERNAL_EMAIL_DOMAINS.includes(email.split('@')[1] as typeof INTERNAL_EMAIL_DOMAINS[number]))
    || null
  )
}

function determineCustomerName(
  fromField: string,
  toField: string,
  direction: string,
  companyDomain: string
): string {
  if (companyDomain !== 'External Customer') {
    return companyDomain || 'Unknown'
  }

  let externalEmail: string | null = null

  if (direction === 'external' && fromField) {
    externalEmail = extractDomainAddress(fromField)
  } else if (direction === 'internal' && toField) {
    const recipients = toField.split(',')
    for (const recipient of recipients) {
      const email = extractDomainAddress(recipient.trim())
      if (!email) continue
      const domain = email.split('@')[1]
      if (!INTERNAL_EMAIL_DOMAINS.includes(domain as typeof INTERNAL_EMAIL_DOMAINS[number])) {
        externalEmail = email
        break
      }
    }
  }

  if (!externalEmail) return companyDomain

  const domainPart = externalEmail.split('@')[1]
  if (!domainPart) return companyDomain

  const candidate = domainPart.split('.')[0]
  if (!candidate) return companyDomain

  return candidate.charAt(0).toUpperCase() + candidate.slice(1)
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1)
    const requestedLimit = parseInt(searchParams.get('limit') || '20', 10)
    const normalizedLimit = Number.isFinite(requestedLimit) ? requestedLimit : 20
    const limitCap = searchParams.get('light') === '1' ? 10000 : 100
    const limit = Math.min(Math.max(normalizedLimit, 1), limitCap)
    const search = searchParams.get('search')?.trim() || ''
    const segment = searchParams.get('segment')?.trim() || ''
    const status = searchParams.get('status')?.trim() || ''
    const severity = searchParams.get('severity')?.trim() || ''
    const department = searchParams.get('department')?.trim() || ''
        // ソート機能はフロントエンドで実装

    const offset = (page - 1) * limit
    const params: Record<string, unknown> = { limit, offset }

    const whereParts: string[] = ['1=1']

    if (search) {
      whereParts.push(`(
        LOWER(subject) LIKE LOWER(@searchTerm)
        OR LOWER(body_preview) LIKE LOWER(@searchTerm)
        OR LOWER(\`from\`) LIKE LOWER(@searchTerm)
        OR LOWER(company_domain) LIKE LOWER(@searchTerm)
      )`)
      params.searchTerm = `%${search}%`
    }

    if (status) {
      whereParts.push('primary_risk_type = @status')
      params.status = status
    }

    if (department) {
      whereParts.push('company_domain LIKE @department')
      params.department = `%${department}%`
    }

    const whereClause = `WHERE ${whereParts.join(' AND ')}`
    const severityClause = buildSeverityClause(severity, params)
    const segmentClause = segment ? '\n  AND new_primary_segment = @segment' : ''
    if (segment) {
      params.segment = segment
    }

    const baseQuery = `
      WITH Base AS (
        SELECT
          message_id,
          thread_id,
          subject,
          subject AS email_subject,
          body_preview,
          \`from\`,
          \`to\`,
          datetime,
          company_domain,
          direction,
          primary_risk_type,
          risk_keywords,
          score,
          reply_level,
          is_root,
          source_uri,
          sentiment_score,
          CASE
            WHEN REGEXP_CONTAINS(LOWER(COALESCE(subject, '')), r'(緊急|至急)') THEN 'urgent_response'
            WHEN REGEXP_CONTAINS(LOWER(COALESCE(subject, '')), r'(解約|キャンセル)') THEN 'churn_risk'
            WHEN REGEXP_CONTAINS(LOWER(COALESCE(subject, '')), r'(競合|他社)') THEN 'competitive_threat'
            WHEN REGEXP_CONTAINS(LOWER(COALESCE(subject, '')), r'(契約|更新)') THEN 'contract_related'
            WHEN REGEXP_CONTAINS(LOWER(COALESCE(subject, '')), r'(追加|拡張)') THEN 'revenue_opportunity'
            ELSE 'other'
          END AS new_primary_segment,
          0.5 AS new_segment_confidence,
          ROW_NUMBER() OVER (
            PARTITION BY COALESCE(thread_id, CONCAT(IFNULL(subject, ''), '|', IFNULL(\`from\`, '')))
            ORDER BY score DESC, datetime DESC
          ) AS row_rank
        FROM \`viewpers.salesguard_alerts.unified_email_messages\`
        ${whereClause}
      ),
      -- 新しい分析モデルの結果を結合
      PhaseCResults AS (
        SELECT 
          thread_id,
          MAX(p_resolved_24h) AS p_resolved_24h,
          MAX(ttr_pred_min) AS ttr_pred_min,
          MAX(hazard_score) AS hazard_score,
          MAX(predicted_at) AS predicted_at
        FROM \`viewpers.salesguard_alerts.incident_outcomes\`
        WHERE predicted_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
        GROUP BY thread_id
      ),
      PhaseDResults AS (
        SELECT 
          thread_id,
          MAX(score) AS quality_score,
          MAX(level) AS quality_level,
          MAX(scored_at) AS scored_at
        FROM \`viewpers.salesguard_alerts.reply_quality\`
        WHERE scored_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
        GROUP BY thread_id
      ),
      DetectionRuleResults AS (
        -- 顧客からの問い合わせに72時間以上未返信（自社営業起因）
        SELECT 
          thread_id,
          'inactivity_72h' AS detection_rule_type,
          TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), MAX(datetime), HOUR) AS hours_since_last_activity,
          LEAST(100, (TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), MAX(datetime), HOUR) - 72) / 24.0 * 20 + 50) AS detection_score
        FROM \`viewpers.salesguard_alerts.unified_email_messages\`
        WHERE direction = 'inbound'
        GROUP BY thread_id
        HAVING hours_since_last_activity >= 72
      ),
      Deduplicated AS (
        SELECT *
        FROM Base
        WHERE row_rank = 1
      ),
      Enriched AS (
        SELECT 
          d.*,
          pc.p_resolved_24h,
          pc.ttr_pred_min,
          pc.hazard_score,
          pd.quality_score,
          pd.quality_level,
          dr.detection_rule_type,
          dr.hours_since_last_activity,
          dr.detection_score AS detection_rule_score,
          -- 統合スコア計算（既存スコア + 新しい指標）
          COALESCE(d.score, 0) + 
            COALESCE((1.0 - pc.p_resolved_24h) * 20, 0) + -- 低鎮火確率を加算
            COALESCE((100 - pd.quality_score) * 0.1, 0) + -- 低品質を加算
            COALESCE(dr.detection_score * 0.3, 0) AS calculated_urgency_score
        FROM Deduplicated d
        LEFT JOIN PhaseCResults pc ON d.thread_id = pc.thread_id
        LEFT JOIN PhaseDResults pd ON d.thread_id = pd.thread_id
        LEFT JOIN DetectionRuleResults dr ON d.thread_id = dr.thread_id
      ),
      Filtered AS (
        SELECT *
        FROM Enriched
        WHERE 1=1${segmentClause}${severityClause}
      )
      SELECT *
      FROM Filtered
        ORDER BY calculated_urgency_score DESC, datetime DESC
      LIMIT @limit OFFSET @offset
    `

    const [rows] = await bigquery.query({
      query: baseQuery,
      params,
      useLegacySql: false,
      location: 'asia-northeast1',
      maximumBytesBilled: '10000000000'
    })

    const countQuery = `
      WITH Base AS (
        SELECT
          ROW_NUMBER() OVER (
            PARTITION BY COALESCE(thread_id, CONCAT(IFNULL(subject, ''), '|', IFNULL(\`from\`, '')))
            ORDER BY score DESC, datetime DESC
          ) AS row_rank,
          CASE
            WHEN REGEXP_CONTAINS(LOWER(COALESCE(subject, '')), r'(緊急|至急)') THEN 'urgent_response'
            WHEN REGEXP_CONTAINS(LOWER(COALESCE(subject, '')), r'(解約|キャンセル)') THEN 'churn_risk'
            WHEN REGEXP_CONTAINS(LOWER(COALESCE(subject, '')), r'(競合|他社)') THEN 'competitive_threat'
            WHEN REGEXP_CONTAINS(LOWER(COALESCE(subject, '')), r'(契約|更新)') THEN 'contract_related'
            WHEN REGEXP_CONTAINS(LOWER(COALESCE(subject, '')), r'(追加|拡張)') THEN 'revenue_opportunity'
            ELSE 'other'
          END AS new_primary_segment,
          (
            CASE
              WHEN REGEXP_CONTAINS(LOWER(COALESCE(subject, '')), r'(緊急|至急)') THEN 50
              WHEN REGEXP_CONTAINS(LOWER(COALESCE(subject, '')), r'(解約|キャンセル)') THEN 40
              WHEN REGEXP_CONTAINS(LOWER(COALESCE(subject, '')), r'(競合|他社)') THEN 25
              WHEN REGEXP_CONTAINS(LOWER(COALESCE(subject, '')), r'(契約|更新)') THEN 15
              WHEN REGEXP_CONTAINS(LOWER(COALESCE(subject, '')), r'(追加|拡張)') THEN 10
              ELSE 5
            END
            + CASE
                WHEN sentiment_score < -0.6 THEN 40
                WHEN sentiment_score < -0.3 THEN 25
                WHEN sentiment_score < 0 THEN 10
                ELSE 0
              END
            + CASE
                WHEN negative_flag THEN 10
                ELSE 0
              END
          ) AS calculated_urgency_score
        FROM \`viewpers.salesguard_alerts.unified_email_messages\`
        ${whereClause}
      ),
      Deduplicated AS (
        SELECT *
        FROM Base
        WHERE row_rank = 1
      ),
      Filtered AS (
        SELECT *
        FROM Deduplicated
        WHERE 1=1${segmentClause}${severityClause}
      )
      SELECT COUNT(*) AS total
      FROM Filtered
    `

    const [countRows] = await bigquery.query({
      query: countQuery,
      params,
      useLegacySql: false,
      location: 'asia-northeast1',
      maximumBytesBilled: '5000000000'
    })

    const total = Number(countRows?.[0]?.total) || 0

    const segmentCountQuery = `
      WITH Base AS (
        SELECT
          CASE
            WHEN REGEXP_CONTAINS(LOWER(COALESCE(subject, '')), r'(緊急|至急)') THEN 'urgent_response'
            WHEN REGEXP_CONTAINS(LOWER(COALESCE(subject, '')), r'(解約|キャンセル)') THEN 'churn_risk'
            WHEN REGEXP_CONTAINS(LOWER(COALESCE(subject, '')), r'(競合|他社)') THEN 'competitive_threat'
            WHEN REGEXP_CONTAINS(LOWER(COALESCE(subject, '')), r'(契約|更新)') THEN 'contract_related'
            WHEN REGEXP_CONTAINS(LOWER(COALESCE(subject, '')), r'(追加|拡張)') THEN 'revenue_opportunity'
            ELSE 'other'
          END AS primary_segment,
          ROW_NUMBER() OVER (
            PARTITION BY COALESCE(thread_id, CONCAT(IFNULL(subject, ''), '|', IFNULL(\`from\`, '')))
            ORDER BY score DESC, datetime DESC
          ) AS row_rank
        FROM \`viewpers.salesguard_alerts.unified_email_messages\`
      ),
      Deduplicated AS (
        SELECT primary_segment
        FROM Base
        WHERE row_rank = 1
      )
      SELECT 
        COUNT(CASE WHEN primary_segment = 'urgent_response' THEN 1 END) AS urgent_response_count,
        COUNT(CASE WHEN primary_segment = 'churn_risk' THEN 1 END) AS churn_risk_count,
        COUNT(CASE WHEN primary_segment = 'competitive_threat' THEN 1 END) AS competitive_threat_count,
        COUNT(CASE WHEN primary_segment = 'contract_related' THEN 1 END) AS contract_related_count,
        COUNT(CASE WHEN primary_segment = 'revenue_opportunity' THEN 1 END) AS revenue_opportunity_count,
        COUNT(CASE WHEN primary_segment = 'other' THEN 1 END) AS other_count
      FROM Deduplicated
    `

    const [segmentCountRows] = await bigquery.query({
      query: segmentCountQuery,
      useLegacySql: false,
      location: 'asia-northeast1',
      maximumBytesBilled: '5000000000'
    })

    const segmentCounts = segmentCountRows?.[0] || {}

      const alerts = rows.map((row: any) => {
      const assignee = determineAssignee(row.from || '', row.to || '', row.direction || '')
      const customerName = determineCustomerName(row.from || '', row.to || '', row.direction || '', row.company_domain || '')
      const urgencyScore = Math.min(Number(row.calculated_urgency_score) || 0, 100)
      const severityGrade = scoreToSeverity(urgencyScore)

      const detectionReasons: string[] = []
      const highlightKeywords: string[] = []
      
      // 新しい分析モデルの結果を検知理由に追加
      if (row.p_resolved_24h !== null && row.p_resolved_24h < 0.3) {
        detectionReasons.push(`鎮火確率が低い (${(row.p_resolved_24h * 100).toFixed(0)}%)`)
      }
      if (row.quality_score !== null && row.quality_score < 60) {
        detectionReasons.push(`返信品質が低い (${row.quality_score.toFixed(0)}点)`)
      }
      if (row.detection_rule_type === 'inactivity_72h') {
        detectionReasons.push(`顧客からの問い合わせに${Math.floor(row.hours_since_last_activity / 24)}日間未返信`)
      }

      switch (row.new_primary_segment) {
        case 'urgent_response':
          detectionReasons.push('緊急対応が必要')
          ;['解約', 'キャンセル', '中止', '停止', '終了', '退会', 'クレーム', '苦情', '問題', 'トラブル', '不満', '怒り'].forEach(keyword => {
            if (row.subject && row.subject.includes(keyword)) highlightKeywords.push(keyword)
          })
          break
        case 'churn_risk':
          detectionReasons.push('解約リスク')
          ;['解約', 'キャンセル', '退会', '辞める', '終了'].forEach(keyword => {
            if (row.subject && row.subject.includes(keyword)) highlightKeywords.push(keyword)
          })
          break
        case 'competitive_threat':
          detectionReasons.push('競合脅威')
          ;['競合', '他社', '比較', '検討', '乗り換え'].forEach(keyword => {
            if (row.subject && row.subject.includes(keyword)) highlightKeywords.push(keyword)
          })
          break
        case 'contract_related':
          detectionReasons.push('契約関連')
          ;['契約', '更新', '見積', '料金', '価格'].forEach(keyword => {
            if (row.subject && row.subject.includes(keyword)) highlightKeywords.push(keyword)
          })
          break
        case 'revenue_opportunity':
          detectionReasons.push('売上機会')
          ;['提案', 'アップグレード', '追加', '拡張'].forEach(keyword => {
            if (row.subject && row.subject.includes(keyword)) highlightKeywords.push(keyword)
          })
          break
        default:
          break
      }

      if (typeof row.sentiment_score === 'number') {
        if (row.sentiment_score < -0.6) {
          detectionReasons.push('強いネガティブ感情')
        } else if (row.sentiment_score < -0.3) {
          detectionReasons.push('ネガティブ感情')
        } else if (row.sentiment_score < 0) {
          detectionReasons.push('軽微なネガティブ感情')
        }
      }

      if (row.negative_flag) {
        detectionReasons.push('ネガティブフラグ検出')
      }

      return {
        id: row.message_id || row.id,
        messageId: row.message_id,
        threadId: row.thread_id,
        subject: row.subject || '',
        customer: customerName || 'Unknown',
        customerEmail: row.from || '',
        department: row.company_domain || '',
        status: 'unhandled',
        severity: severityGrade,
        level: severityGrade === 'A' ? 'high' : severityGrade === 'B' ? 'medium' : 'low',
        phrases: row.risk_keywords || '',
        datetime: row.datetime?.value || row.datetime,
        updatedAt: row.datetime?.value || row.datetime,
        updated_at: row.datetime?.value || row.datetime,
        aiSummary: row.body_preview || '',
        companyDomain: row.company_domain || '',
        replyLevel: row.reply_level || 0,
        isRoot: row.is_root || false,
        sourceFile: row.source_uri || '',
        sentimentLabel: row.sentiment_label,
        sentimentScore: row.sentiment_score,
        negativeFlag: row.negative_flag,
        primarySegment: row.new_primary_segment || null,
        segmentConfidence: row.new_segment_confidence || 0,
        assignee: assignee || '未割り当て',
        urgencyScore,
        detection_score: urgencyScore,
        detectionReasons,
        highlightKeywords: [...new Set(highlightKeywords)],
        // 新しい分析モデルの指標
        phaseC: row.p_resolved_24h !== null ? {
          p_resolved_24h: row.p_resolved_24h,
          ttr_pred_min: row.ttr_pred_min,
          hazard_score: row.hazard_score,
        } : null,
        phaseD: row.quality_score !== null ? {
          quality_score: row.quality_score,
          quality_level: row.quality_level,
        } : null,
        detectionRule: row.detection_rule_type ? {
          rule_type: row.detection_rule_type,
          hours_since_last_activity: row.hours_since_last_activity,
          score: row.detection_rule_score,
        } : null,
      }
    })

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
        urgent_response: segmentCounts.urgent_response_count || 0,
        churn_risk: segmentCounts.churn_risk_count || 0,
        competitive_threat: segmentCounts.competitive_threat_count || 0,
        contract_related: segmentCounts.contract_related_count || 0,
        revenue_opportunity: segmentCounts.revenue_opportunity_count || 0,
        other: segmentCounts.other_count || 0
      }
    })

    response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=300')
    response.headers.set('CDN-Cache-Control', 'public, max-age=300')
    response.headers.set('Vercel-CDN-Cache-Control', 'public, max-age=300')
    response.headers.set('X-App-Instance', process.env.VERCEL_DEPLOYMENT_ID || 'local')
    response.headers.set('X-BQ-Project', 'viewpers')
    response.headers.set('X-Route', 'alerts-unified-nlp')

    return response

  } catch (error: any) {
    console.error('Alerts API error:', { message: error?.message, url: request?.url })
    return NextResponse.json({
      success: false,
      message: error?.message || 'Failed to fetch alerts',
      alerts: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      segmentCounts: {
        urgent_response: 0,
        churn_risk: 0,
        competitive_threat: 0,
        contract_related: 0,
        revenue_opportunity: 0,
        other: 0
      }
    }, { status: 500 })
  }
}

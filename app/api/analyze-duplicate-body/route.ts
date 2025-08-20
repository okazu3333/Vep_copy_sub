import { NextRequest, NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const analysisType = searchParams.get('type') || 'summary'
    
    let query = ''
    let description = ''
    
    switch (analysisType) {
      case 'summary':
        // 本文重複の基本統計
        query = `
          WITH BodyAnalysis AS (
            SELECT 
              body,
              COUNT(*) as duplicate_count,
              COUNT(DISTINCT thread_id) as unique_threads,
              COUNT(DISTINCT \`from\`) as unique_senders
            FROM \`viewpers.salesguard_alerts.email_messages\`
            WHERE body IS NOT NULL AND LENGTH(TRIM(body)) > 0
            GROUP BY body
            HAVING COUNT(*) > 1
          )
          SELECT 
            COUNT(*) as total_duplicate_bodies,
            SUM(duplicate_count) as total_duplicate_records,
            AVG(duplicate_count) as avg_duplicate_count,
            MAX(duplicate_count) as max_duplicate_count
          FROM BodyAnalysis
        `
        description = '本文重複の基本統計'
        break
        
      case 'detailed':
        // 本文重複の詳細分析
        query = `
          WITH BodyAnalysis AS (
            SELECT 
              body,
              COUNT(*) as duplicate_count,
              COUNT(DISTINCT thread_id) as unique_threads,
              COUNT(DISTINCT \`from\`) as unique_senders,
              MIN(date) as first_occurrence,
              MAX(date) as last_occurrence
            FROM \`viewpers.salesguard_alerts.email_messages\`
            WHERE body IS NOT NULL AND LENGTH(TRIM(body)) > 0
            GROUP BY body
            HAVING COUNT(*) > 1
          )
          SELECT 
            body,
            duplicate_count,
            unique_threads,
            unique_senders,
            first_occurrence,
            last_occurrence
          FROM BodyAnalysis
          ORDER BY duplicate_count DESC
          LIMIT 20
        `
        description = '本文重複の詳細分析（上位20件）'
        break
        
      case 'duplicate_levels':
        // 重複レベルの分布
        query = `
          WITH BodyAnalysis AS (
            SELECT 
              body,
              COUNT(*) as duplicate_count
            FROM \`viewpers.salesguard_alerts.email_messages\`
            WHERE body IS NOT NULL AND LENGTH(TRIM(body)) > 0
            GROUP BY body
            HAVING COUNT(*) > 1
          )
          SELECT 
            CASE 
              WHEN duplicate_count = 2 THEN '2回重複'
              WHEN duplicate_count = 3 THEN '3回重複'
              WHEN duplicate_count = 4 THEN '4回重複'
              WHEN duplicate_count = 5 THEN '5回重複'
              WHEN duplicate_count BETWEEN 6 AND 10 THEN '6-10回重複'
              WHEN duplicate_count BETWEEN 11 AND 20 THEN '11-20回重複'
              WHEN duplicate_count BETWEEN 21 AND 50 THEN '21-50回重複'
              ELSE '50回以上重複'
            END as duplicate_level,
            COUNT(*) as body_count,
            SUM(duplicate_count) as total_records
          FROM BodyAnalysis
          GROUP BY duplicate_level
          ORDER BY 
            CASE 
              WHEN duplicate_level = '2回重複' THEN 1
              WHEN duplicate_level = '3回重複' THEN 2
              WHEN duplicate_level = '4回重複' THEN 3
              WHEN duplicate_level = '5回重複' THEN 4
              WHEN duplicate_level = '6-10回重複' THEN 5
              WHEN duplicate_level = '11-20回重複' THEN 6
              WHEN duplicate_level = '21-50回重複' THEN 7
              ELSE 8
            END
        `
        description = '重複レベルの分布'
        break
        
      case 'sample_duplicates':
        // 重複本文のサンプル
        query = `
          WITH BodyAnalysis AS (
            SELECT 
              body,
              COUNT(*) as duplicate_count
            FROM \`viewpers.salesguard_alerts.email_messages\`
            WHERE body IS NOT NULL AND LENGTH(TRIM(body)) > 0
            GROUP BY body
            HAVING COUNT(*) > 1
          )
          SELECT 
            ba.body,
            ba.duplicate_count,
            em.thread_id,
            em.\`from\`,
            em.subject,
            em.date
          FROM BodyAnalysis ba
          JOIN \`viewpers.salesguard_alerts.email_messages\` em ON ba.body = em.body
          WHERE ba.duplicate_count >= 5
          ORDER BY ba.duplicate_count DESC, em.date DESC
          LIMIT 10
        `
        description = '重複本文のサンプル（5回以上重複）'
        break
        
      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid analysis type',
          availableTypes: ['summary', 'detailed', 'duplicate_levels', 'sample_duplicates']
        })
    }

    const result = await bigquery.query({
      query: query,
      useLegacySql: false,
      maximumBytesBilled: '1000000000'
    })

    const data = result[0] || []

    return NextResponse.json({
      success: true,
      analysisType: analysisType,
      description: description,
      data: data,
      recordCount: data.length
    })

  } catch (error) {
    console.error('Duplicate body analysis error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to analyze duplicate body',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 
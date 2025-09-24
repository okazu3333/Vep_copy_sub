import { NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery()

export async function POST() {
  try {
    console.log('🏗️ NLP分析用テーブル作成開始...')

    // 1. NLP分析結果テーブル
    const createNlpResultsTableQuery = `
      CREATE TABLE IF NOT EXISTS \`viewpers.salesguard_alerts.nlp_analysis_results\` (
        message_id STRING,
        thread_id STRING,
        sender_email STRING,
        subject STRING,
        body STRING,
        date STRING,
        nlp_analysis STRUCT<
          sentiment_score FLOAT64,
          sentiment_magnitude FLOAT64,
          entities ARRAY<STRUCT<
            name STRING,
            type STRING,
            salience FLOAT64
          >>,
          categories ARRAY<STRUCT<
            name STRING,
            confidence FLOAT64
          >>,
          syntax_info STRUCT<
            language STRING,
            text_length INT64
          >
        >,
        pattern_matches ARRAY<STRUCT<
          pattern_id STRING,
          pattern_name STRING,
          confidence FLOAT64,
          matched_conditions ARRAY<STRING>,
          risk_score FLOAT64,
          urgency_level STRING,
          business_impact STRING,
          recommended_actions ARRAY<STRING>
        >>,
        top_pattern STRUCT<
          pattern_id STRING,
          pattern_name STRING,
          confidence FLOAT64,
          risk_score FLOAT64,
          urgency_level STRING,
          business_impact STRING
        >,
        final_risk_score FLOAT64,
        final_urgency_level STRING,
        final_business_impact STRING,
        assigned_segments ARRAY<STRING>,
        error STRUCT<
          message STRING,
          type STRING,
          stack STRING
        >,
        analysis_timestamp TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
      )
      PARTITION BY DATE(analysis_timestamp)
      CLUSTER BY thread_id, sender_email
    `

    // 2. セグメント振り分け結果テーブル
    const createSegmentDistributionTableQuery = `
      CREATE TABLE IF NOT EXISTS \`viewpers.salesguard_alerts.segment_distribution\` (
        thread_id STRING,
        alert_id STRING,
        primary_segment STRING,
        secondary_segments ARRAY<STRING>,
        risk_score FLOAT64,
        urgency_level STRING,
        business_impact STRING,
        pattern_matches_count INT64,
        nlp_confidence FLOAT64,
        analysis_timestamp TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
      )
      PARTITION BY DATE(analysis_timestamp)
      CLUSTER BY primary_segment, urgency_level
    `

    // 3. 分析統計テーブル
    const createAnalysisStatsTableQuery = `
      CREATE TABLE IF NOT EXISTS \`viewpers.salesguard_alerts.analysis_statistics\` (
        analysis_date DATE,
        total_processed INT64,
        successful_analyses INT64,
        failed_analyses INT64,
        segment_distribution STRUCT<
          complaint_urgent INT64,
          complaint_general INT64,
          anxiety_negative INT64,
          positive_engagement INT64,
          tone_change_negative INT64,
          cancellation_termination INT64,
          upsell_opportunity INT64,
          cold_rejection INT64,
          internal_crisis INT64
        >,
        risk_score_distribution STRUCT<
          high_risk INT64,
          medium_risk INT64,
          low_risk INT64
        >,
        urgency_distribution STRUCT<
          critical INT64,
          high INT64,
          medium INT64,
          low INT64
        >,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
      )
      PARTITION BY analysis_date
    `

    console.log('📊 テーブル作成クエリ実行中...')

    await Promise.all([
      bigquery.query({
        query: createNlpResultsTableQuery,
        useLegacySql: false,
        maximumBytesBilled: '1000000000'
      }),
      bigquery.query({
        query: createSegmentDistributionTableQuery,
        useLegacySql: false,
        maximumBytesBilled: '1000000000'
      }),
      bigquery.query({
        query: createAnalysisStatsTableQuery,
        useLegacySql: false,
        maximumBytesBilled: '1000000000'
      })
    ])

    console.log('✅ テーブル作成完了')

    // テーブルの存在確認
    const checkTablesQuery = `
      SELECT 
        table_id,
        creation_time,
        row_count
      FROM \`viewpers.salesguard_alerts.__TABLES__\`
      WHERE table_id IN ('nlp_analysis_results', 'segment_distribution', 'analysis_statistics')
      ORDER BY table_id
    `

    const checkResult = await bigquery.query({
      query: checkTablesQuery,
      useLegacySql: false
    })

    const existingTables = checkResult[0] || []

    return NextResponse.json({
      success: true,
      message: 'NLP分析用テーブルが正常に作成されました',
      created_tables: [
        'nlp_analysis_results',
        'segment_distribution', 
        'analysis_statistics'
      ],
      existing_tables: existingTables,
      created_at: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ テーブル作成エラー:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to create NLP tables',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 
import { NextRequest, NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery()

export async function POST(request: NextRequest) {
  try {
    console.log('🏗️ シンプルなNLP分析テーブル作成開始...')

    // 既存の複雑なテーブルを削除
    const dropTableQuery = `
      DROP TABLE IF EXISTS \`viewpers.salesguard_alerts.nlp_analysis_results\`
    `

    await bigquery.query({
      query: dropTableQuery,
      useLegacySql: false
    })

    console.log('🗑️ 既存の複雑なテーブルを削除しました')

    // シンプルなスキーマでテーブルを作成
    const createTableQuery = `
      CREATE TABLE \`viewpers.salesguard_alerts.nlp_analysis_results\` (
        message_id STRING,
        thread_id STRING,
        sender_email STRING,
        subject STRING,
        body STRING,
        date STRING,
        nlp_sentiment_score FLOAT64,
        nlp_sentiment_magnitude FLOAT64,
        nlp_language STRING,
        pattern_matches_count INT64,
        top_pattern_name STRING,
        top_pattern_confidence FLOAT64,
        final_risk_score FLOAT64,
        final_urgency_level STRING,
        final_business_impact STRING,
        assigned_segments_count INT64,
        error_message STRING,
        analysis_timestamp TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
      )
      PARTITION BY DATE(analysis_timestamp)
      CLUSTER BY thread_id, sender_email
    `

    await bigquery.query({
      query: createTableQuery,
      useLegacySql: false
    })

    console.log('✅ シンプルなNLP分析テーブルを作成しました')

    // スキーマの確認
    const checkSchemaQuery = `
      SELECT 
        column_name,
        data_type,
        is_nullable
      FROM \`viewpers.salesguard_alerts.INFORMATION_SCHEMA.COLUMNS\`
      WHERE table_name = 'nlp_analysis_results'
      ORDER BY ordinal_position
    `

    const [schemaInfo] = await bigquery.query({
      query: checkSchemaQuery,
      useLegacySql: false
    })

    return NextResponse.json({
      success: true,
      message: 'シンプルなNLP分析テーブルが正常に作成されました',
      schema: schemaInfo,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ シンプルなNLP分析テーブル作成エラー:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to create simple NLP table',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 
import { NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery()

export async function POST() {
  try {
    console.log('🔧 テーブルスキーマ更新開始...')

    // テーブルを削除して再作成（スキーマ変更のため）
    const dropTableQuery = `
      DROP TABLE IF EXISTS \`viewpers.salesguard_alerts.nlp_analysis_results\`
    `

    await bigquery.query({
      query: dropTableQuery,
      useLegacySql: false
    })

    console.log('🗑️ 既存テーブルを削除しました')

    // 新しいスキーマでテーブルを作成
    const createTableQuery = `
      CREATE TABLE \`viewpers.salesguard_alerts.nlp_analysis_results\` (
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

    await bigquery.query({
      query: createTableQuery,
      useLegacySql: false
    })

    console.log('✅ 新しいスキーマでテーブルを作成しました')

    // 更新されたスキーマの確認
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
      message: 'テーブルスキーマが正常に更新されました',
      updated_schema: schemaInfo,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ テーブルスキーマ更新エラー:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to update table schema',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 
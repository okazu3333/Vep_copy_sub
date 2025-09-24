import { NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery()

export async function POST() {
  try {
    console.log('🧪 シンプルなBigQuery挿入テスト開始...')

    // テスト用のシンプルなテーブルを作成
    const createTestTableQuery = `
      CREATE TABLE IF NOT EXISTS \`viewpers.salesguard_alerts.test_simple_insert\` (
        id STRING,
        name STRING,
        value INT64,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
      )
    `

    await bigquery.query({
      query: createTestTableQuery,
      useLegacySql: false
    })

    console.log('✅ テストテーブルを作成しました')

    // シンプルなデータを挿入
    const testData = [
      {
        id: 'test-1',
        name: 'テスト1',
        value: 100
      },
      {
        id: 'test-2',
        name: 'テスト2',
        value: 200
      }
    ]

    const dataset = bigquery.dataset('salesguard_alerts')
    const table = dataset.table('test_simple_insert')

    await table.insert(testData)
    console.log('✅ シンプルなデータの挿入が成功しました')

    // 挿入されたデータを確認
    const selectQuery = `
      SELECT * FROM \`viewpers.salesguard_alerts.test_simple_insert\`
      ORDER BY created_at DESC
      LIMIT 5
    `

    const [results] = await bigquery.query({
      query: selectQuery,
      useLegacySql: false
    })

    return NextResponse.json({
      success: true,
      message: 'シンプルな挿入テストが成功しました',
      inserted_data: testData,
      retrieved_data: results,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ シンプルな挿入テストエラー:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to test simple insert',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 
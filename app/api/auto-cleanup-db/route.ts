import { NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery()

export async function POST() {
  try {
    console.log('🚀 データベースクリーンアップを開始...')

    // 1. 文字化けしていないデータのみを抽出して新しいテーブルを作成
    console.log('📋 クリーンテーブルの作成中...')
    const createCleanTableQuery = `
      CREATE TABLE \`viewpers.salesguard_alerts.email_messages_clean\` AS
      SELECT 
        message_id,
        thread_id,
        subject,
        \`from\`,
        \`to\`,
        body,
        date,
        reply_level,
        is_root,
        source_file
      FROM \`viewpers.salesguard_alerts.email_messages\`
      WHERE 
        body NOT LIKE '%%' AND 
        body NOT LIKE '$B%' AND
        body NOT LIKE '%$B%'
    `

    await bigquery.query({
      query: createCleanTableQuery,
      useLegacySql: false
    })

    console.log('✅ クリーンテーブルの作成完了')

    // 2. クリーンデータの件数を確認
    console.log('🔍 クリーンデータの件数を確認中...')
    const countQuery = `
      SELECT 
        COUNT(*) as clean_records,
        COUNT(DISTINCT thread_id) as clean_threads
      FROM \`viewpers.salesguard_alerts.email_messages_clean\`
    `

    const countResults = await bigquery.query({
      query: countQuery,
      useLegacySql: false
    })

    const cleanRecords = countResults[0]?.[0]?.clean_records || 0
    const cleanThreads = countResults[0]?.[0]?.clean_threads || 0

    console.log(`📊 クリーンデータ: ${cleanRecords}件, スレッド: ${cleanThreads}件`)

    // 3. alert_idカラムを追加
    console.log('🔧 alert_idカラムを追加中...')
    const addColumnQuery = `
      ALTER TABLE \`viewpers.salesguard_alerts.email_messages_clean\`
      ADD COLUMN alert_id INT64
    `

    await bigquery.query({
      query: addColumnQuery,
      useLegacySql: false
    })

    console.log('✅ alert_idカラムの追加完了')

    // 4. thread_idごとに連番を設定
    console.log('🔢 alert_idの連番設定中...')
    const updateQuery = `
      UPDATE \`viewpers.salesguard_alerts.email_messages_clean\`
      SET alert_id = (
        SELECT alert_id
        FROM (
          SELECT 
            thread_id,
            ROW_NUMBER() OVER (ORDER BY MIN(date)) as alert_id
          FROM \`viewpers.salesguard_alerts.email_messages_clean\`
          GROUP BY thread_id
        ) ranked
        WHERE ranked.thread_id = \`viewpers.salesguard_alerts.email_messages_clean\`.thread_id
      )
      WHERE alert_id IS NULL
    `

    await bigquery.query({
      query: updateQuery,
      useLegacySql: false
    })

    console.log('✅ alert_idの連番設定完了')

    // 5. 古いテーブルを削除して新しいテーブルに置き換え
    console.log('🔄 テーブルの置き換え中...')
    const dropOldTableQuery = `
      DROP TABLE \`viewpers.salesguard_alerts.email_messages\`
    `

    await bigquery.query({
      query: dropOldTableQuery,
      useLegacySql: false
    })

    console.log('✅ 古いテーブルの削除完了')

    const renameTableQuery = `
      ALTER TABLE \`viewpers.salesguard_alerts.email_messages_clean\`
      RENAME TO \`viewpers.salesguard_alerts.email_messages\`
    `

    await bigquery.query({
      query: renameTableQuery,
      useLegacySql: false
    })

    console.log('✅ テーブルの名前変更完了')

    // 6. 最終確認
    console.log('🔍 最終確認中...')
    const finalCheckQuery = `
      SELECT 
        COUNT(*) as total_records,
        COUNT(alert_id) as alert_id_set_count,
        MIN(alert_id) as min_alert_id,
        MAX(alert_id) as max_alert_id
      FROM \`viewpers.salesguard_alerts.email_messages\`
    `

    const finalResults = await bigquery.query({
      query: finalCheckQuery,
      useLegacySql: false
    })

    const finalSummary = finalResults[0]?.[0] || {}

    console.log('🎉 データベースクリーンアップ完了！')

    return NextResponse.json({
      success: true,
      message: 'データベースクリーンアップが完了しました',
      data: {
        cleanRecords,
        cleanThreads,
        finalSummary,
        steps: [
          'クリーンテーブルの作成完了',
          'alert_idカラムの追加完了',
          'alert_idの連番設定完了',
          'テーブルの置き換え完了'
        ]
      }
    })

  } catch (error) {
    console.error('❌ データベースクリーンアップエラー:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'データベースクリーンアップに失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    // 現在のテーブル状況を確認
    const checkQuery = `
      SELECT 
        COUNT(*) as total_records,
        COUNT(alert_id) as alert_id_set_count,
        MIN(alert_id) as min_alert_id,
        MAX(alert_id) as max_alert_id
      FROM \`viewpers.salesguard_alerts.email_messages\`
    `

    const results = await bigquery.query({
      query: checkQuery,
      useLegacySql: false
    })

    // サンプルデータも確認
    const sampleQuery = `
      SELECT 
        thread_id,
        alert_id,
        subject,
        \`from\`,
        \`to\`,
        date
      FROM \`viewpers.salesguard_alerts.email_messages\`
      ORDER BY alert_id ASC
      LIMIT 5
    `

    const sampleResults = await bigquery.query({
      query: sampleQuery,
      useLegacySql: false
    })

    return NextResponse.json({
      success: true,
      data: {
        summary: results[0]?.[0] || {},
        sampleData: sampleResults[0] || [],
        message: '現在のテーブル状況の確認が完了しました'
      }
    })

  } catch (error) {
    console.error('Check table status API error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to check table status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 
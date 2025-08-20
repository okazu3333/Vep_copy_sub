import { NextRequest, NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery()

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 デコード状況分析開始...')

    // 1. 全体の件数
    const totalCountQuery = `
      SELECT COUNT(*) as total_count
      FROM \`viewpers.salesguard_alerts.alerts_clean_v7_dedup\`
    `

    // 2. 文字化けデータの件数（$B...$Bパターン）
    const garbledCountQuery = `
      SELECT COUNT(*) as garbled_count
      FROM \`viewpers.salesguard_alerts.alerts_clean_v7_dedup\`
      WHERE body LIKE '$B%' OR body LIKE '%$B%'
    `

    // 3. 現在のAPIで除外している文字化けデータの件数
    const currentExcludedQuery = `
      SELECT COUNT(*) as current_excluded_count
      FROM \`viewpers.salesguard_alerts.alerts_clean_v7_dedup\`
      WHERE (
        body LIKE '$B%' OR
        body LIKE '%$B%' OR
        body LIKE '%以下のとおり配信依頼送信完了しました%' OR
        subject LIKE '%配信管理システム配信完了報告%' OR
        \`from\` LIKE '%info@%' OR
        \`from\` LIKE '%noreply@%' OR
        \`from\` LIKE '%support@%' OR
        \`from\` LIKE '%magazine@%'
      )
    `

    // 4. デコード済み（文字化けなし）の件数
    const decodedCountQuery = `
      SELECT COUNT(*) as decoded_count
      FROM \`viewpers.salesguard_alerts.alerts_clean_v7_dedup\`
      WHERE (
        body NOT LIKE '$B%' AND
        body NOT LIKE '%$B%' AND
        body NOT LIKE '%以下のとおり配信依頼送信完了しました%' AND
        subject NOT LIKE '%配信管理システム配信完了報告%' AND
        \`from\` NOT LIKE '%info@%' AND
        \`from\` NOT LIKE '%noreply@%' AND
        \`from\` NOT LIKE '%support@%' AND
        \`from\` NOT LIKE '%magazine@%'
      )
    `

    // 5. 文字化けデータの詳細分析
    const garbledDetailsQuery = `
      SELECT 
        CASE 
          WHEN body LIKE '$B%' THEN 'Base64/Shift-JIS開始'
          WHEN body LIKE '%$B%' THEN 'Base64/Shift-JIS含む'
          WHEN body LIKE '%以下のとおり配信依頼送信完了しました%' THEN '配信管理システム'
          WHEN subject LIKE '%配信管理システム配信完了報告%' THEN '配信完了報告'
          WHEN \`from\` LIKE '%info@%' THEN 'info@系'
          WHEN \`from\` LIKE '%noreply@%' THEN 'noreply@系'
          WHEN \`from\` LIKE '%support@%' THEN 'support@系'
          WHEN \`from\` LIKE '%magazine@%' THEN 'magazine@系'
          ELSE 'その他'
        END as exclusion_reason,
        COUNT(*) as count
      FROM \`viewpers.salesguard_alerts.alerts_clean_v7_dedup\`
      WHERE (
        body LIKE '$B%' OR
        body LIKE '%$B%' OR
        body LIKE '%以下のとおり配信依頼送信完了しました%' OR
        subject LIKE '%配信管理システム配信完了報告%' OR
        \`from\` LIKE '%info@%' OR
        \`from\` LIKE '%noreply@%' OR
        \`from\` LIKE '%support@%' OR
        \`from\` LIKE '%magazine@%'
      )
      GROUP BY exclusion_reason
      ORDER BY count DESC
    `

    // 6. サンプルデータ（デコード済み）
    const sampleDecodedQuery = `
      SELECT 
        message_id,
        subject,
        \`from\`,
        SUBSTR(body, 1, 200) as body_preview,
        date,
        thread_id
      FROM \`viewpers.salesguard_alerts.alerts_clean_v7_dedup\`
      WHERE (
        body NOT LIKE '$B%' AND
        body NOT LIKE '%$B%' AND
        body NOT LIKE '%以下のとおり配信依頼送信完了しました%' AND
        subject NOT LIKE '%配信管理システム配信完了報告%' AND
        \`from\` NOT LIKE '%info@%' AND
        \`from\` NOT LIKE '%noreply@%' AND
        \`from\` NOT LIKE '%support@%' AND
        \`from\` NOT LIKE '%magazine@%'
      )
      ORDER BY date DESC
      LIMIT 5
    `

    console.log('📊 BigQueryクエリ実行中...')

    const [
      totalResults,
      garbledResults,
      currentExcludedResults,
      decodedResults,
      garbledDetailsResults,
      sampleDecodedResults
    ] = await Promise.all([
      bigquery.query({ query: totalCountQuery, useLegacySql: false }),
      bigquery.query({ query: garbledCountQuery, useLegacySql: false }),
      bigquery.query({ query: currentExcludedQuery, useLegacySql: false }),
      bigquery.query({ query: decodedCountQuery, useLegacySql: false }),
      bigquery.query({ query: garbledDetailsQuery, useLegacySql: false }),
      bigquery.query({ query: sampleDecodedQuery, useLegacySql: false })
    ])

    const totalCount = totalResults[0]?.[0]?.total_count || 0
    const garbledCount = garbledResults[0]?.[0]?.garbled_count || 0
    const currentExcludedCount = currentExcludedResults[0]?.[0]?.current_excluded_count || 0
    const decodedCount = decodedResults[0]?.[0]?.decoded_count || 0
    const garbledDetails = garbledDetailsResults[0] || []
    const sampleDecoded = sampleDecodedResults[0] || []

    console.log('✅ 分析完了:', {
      totalCount,
      garbledCount,
      currentExcludedCount,
      decodedCount
    })

    return NextResponse.json({
      success: true,
      summary: {
        total_records: totalCount,
        garbled_records: garbledCount,
        currently_excluded: currentExcludedCount,
        available_for_nlp: decodedCount,
        exclusion_percentage: totalCount > 0 ? ((currentExcludedCount / totalCount) * 100).toFixed(2) : 0,
        available_percentage: totalCount > 0 ? ((decodedCount / totalCount) * 100).toFixed(2) : 0
      },
      garbled_breakdown: garbledDetails,
      sample_decoded: sampleDecoded,
      analysis_timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ デコード状況分析エラー:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to analyze decode status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 
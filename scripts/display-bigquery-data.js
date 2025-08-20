const { BigQuery } = require('@google-cloud/bigquery')

const bigquery = new BigQuery({
  projectId: 'viewpers'
})

async function displayBigQueryData() {
  try {
    console.log('🔍 BigQueryデータを取得中...\n')

    // 1. 統計情報を取得
    console.log('📊 統計情報:')
    const statsQuery = `
      SELECT 
        COUNT(*) as total_records,
        COUNT(CASE WHEN decoded_recipient NOT LIKE '%=?%' THEN 1 END) as decoded_recipients,
        COUNT(CASE WHEN decoded_subject NOT LIKE '%=?%' THEN 1 END) as decoded_subjects,
        COUNT(CASE WHEN decoded_body NOT LIKE '%=?%' THEN 1 END) as decoded_bodies,
        AVG(quality_score) as avg_quality_score,
        COUNT(CASE WHEN quality_score >= 80 THEN 1 END) as high_quality_records,
        COUNT(CASE WHEN quality_score < 50 THEN 1 END) as low_quality_records
      FROM \`viewpers.salesguard_data.japanese_decoded_emails\`
    `

    const [statsResult] = await bigquery.query({ query: statsQuery })
    const stats = statsResult[0]

    console.log(`  総レコード数: ${stats.total_records.toLocaleString()}件`)
    console.log(`  デコード済み受信者: ${stats.decoded_recipients.toLocaleString()}件`)
    console.log(`  デコード済み件名: ${stats.decoded_subjects.toLocaleString()}件`)
    console.log(`  デコード済み本文: ${stats.decoded_bodies.toLocaleString()}件`)
    console.log(`  平均品質スコア: ${stats.avg_quality_score.toFixed(2)}点`)
    console.log(`  高品質レコード: ${stats.high_quality_records.toLocaleString()}件`)
    console.log(`  低品質レコード: ${stats.low_quality_records.toLocaleString()}件`)

    // 2. 最新の20件を取得
    console.log('\n📧 最新の20件:')
    const recentQuery = `
      SELECT 
        message_id,
        decoded_sender,
        decoded_recipient,
        decoded_subject,
        decoded_snippet,
        decoded_body,
        created_at,
        status,
        priority,
        customer_name,
        quality_score,
        encoding_type
      FROM \`viewpers.salesguard_data.japanese_decoded_emails\`
      ORDER BY created_at DESC
      LIMIT 20
    `

    const [recentResult] = await bigquery.query({ query: recentQuery })
    
    recentResult.forEach((row, index) => {
      console.log(`\n${index + 1}. メールID: ${row.message_id}`)
      console.log(`   送信者: ${row.decoded_sender || '不明'}`)
      console.log(`   受信者: ${row.decoded_recipient || '不明'}`)
      console.log(`   件名: ${row.decoded_subject || '件名なし'}`)
      console.log(`   サマリー: ${row.decoded_snippet?.substring(0, 100)}...`)
      console.log(`   本文: ${row.decoded_body?.substring(0, 200)}...`)
      console.log(`   作成日時: ${row.created_at}`)
      console.log(`   ステータス: ${row.status || '未処理'}`)
      console.log(`   優先度: ${row.priority || '不明'}`)
      console.log(`   顧客名: ${row.customer_name || '不明'}`)
      console.log(`   品質スコア: ${row.quality_score || 'N/A'}点`)
      console.log(`   エンコーディング: ${row.encoding_type || '不明'}`)
    })

    // 3. エンコーディングタイプ別統計
    console.log('\n🔤 エンコーディングタイプ別統計:')
    const encodingQuery = `
      SELECT 
        encoding_type,
        COUNT(*) as count,
        AVG(quality_score) as avg_quality
      FROM \`viewpers.salesguard_data.japanese_decoded_emails\`
      WHERE encoding_type IS NOT NULL
      GROUP BY encoding_type
      ORDER BY count DESC
    `

    const [encodingResult] = await bigquery.query({ query: encodingQuery })
    
    encodingResult.forEach(row => {
      console.log(`   ${row.encoding_type}: ${row.count.toLocaleString()}件 (平均品質: ${row.avg_quality?.toFixed(2) || 'N/A'}点)`)
    })

    // 4. 品質スコア別統計
    console.log('\n📈 品質スコア別統計:')
    const qualityQuery = `
      SELECT 
        CASE 
          WHEN quality_score >= 90 THEN '90-100 (優秀)'
          WHEN quality_score >= 80 THEN '80-89 (良好)'
          WHEN quality_score >= 70 THEN '70-79 (普通)'
          WHEN quality_score >= 60 THEN '60-69 (低い)'
          WHEN quality_score >= 50 THEN '50-59 (非常に低い)'
          ELSE '50未満 (問題あり)'
        END as quality_range,
        COUNT(*) as count
      FROM \`viewpers.salesguard_data.japanese_decoded_emails\`
      WHERE quality_score IS NOT NULL
      GROUP BY quality_range
      ORDER BY 
        CASE 
          WHEN quality_range LIKE '90%' THEN 1
          WHEN quality_range LIKE '80%' THEN 2
          WHEN quality_range LIKE '70%' THEN 3
          WHEN quality_range LIKE '60%' THEN 4
          WHEN quality_range LIKE '50%' THEN 5
          ELSE 6
        END
    `

    const [qualityResult] = await bigquery.query({ query: qualityQuery })
    
    qualityResult.forEach(row => {
      console.log(`   ${row.quality_range}: ${row.count.toLocaleString()}件`)
    })

    console.log('\n✅ BigQueryデータの表示が完了しました')

  } catch (error) {
    console.error('❌ エラーが発生しました:', error)
  }
}

displayBigQueryData() 
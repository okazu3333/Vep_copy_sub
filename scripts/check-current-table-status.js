const { BigQuery } = require('@google-cloud/bigquery');

const bigquery = new BigQuery({
  projectId: 'viewpers'
});

async function checkCurrentTableStatus() {
  try {
    console.log('🔍 現在のテーブル状況を分析します...\n');

    // 1. 現在のテーブル統計
    console.log('📊 ステップ1: 現在のテーブル統計');
    const currentStats = await bigquery.query(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(CASE WHEN decoded_sender NOT LIKE '%=?%' THEN 1 END) as decoded_senders,
        COUNT(CASE WHEN decoded_subject NOT LIKE '%=?%' THEN 1 END) as decoded_subjects,
        AVG(quality_score) as avg_quality,
        COUNT(CASE WHEN quality_score >= 80 THEN 1 END) as high_quality_records,
        COUNT(CASE WHEN quality_score >= 70 THEN 1 END) as medium_quality_records,
        COUNT(CASE WHEN quality_score < 50 THEN 1 END) as low_quality_records
      FROM \`viewpers.salesguard_data.completely_decoded_emails\`
    `);

    const stats = currentStats[0][0];
    console.log(`  - 総レコード数: ${stats.total_records.toLocaleString()}件`);
    console.log(`  - デコード済み送信者: ${stats.decoded_senders.toLocaleString()}件 (${(stats.decoded_senders/stats.total_records*100).toFixed(1)}%)`);
    console.log(`  - デコード済み件名: ${stats.decoded_subjects.toLocaleString()}件 (${(stats.decoded_subjects/stats.total_records*100).toFixed(1)}%)`);
    console.log(`  - 平均品質スコア: ${stats.avg_quality.toFixed(1)}点`);
    console.log(`  - 高品質レコード: ${stats.high_quality_records.toLocaleString()}件 (${(stats.high_quality_records/stats.total_records*100).toFixed(1)}%)`);
    console.log(`  - 中品質レコード: ${stats.medium_quality_records.toLocaleString()}件 (${(stats.medium_quality_records/stats.total_records*100).toFixed(1)}%)`);
    console.log(`  - 低品質レコード: ${stats.low_quality_records.toLocaleString()}件 (${(stats.low_quality_records/stats.total_records*100).toFixed(1)}%)`);

    // 2. 重複チェック
    console.log('\n📊 ステップ2: 重複チェック');
    const duplicateCheck = await bigquery.query(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(DISTINCT message_id) as unique_records,
        COUNT(*) - COUNT(DISTINCT message_id) as duplicate_records
      FROM \`viewpers.salesguard_data.completely_decoded_emails\`
    `);

    const duplicateStats = duplicateCheck[0][0];
    console.log(`  - 総レコード数: ${duplicateStats.total_records.toLocaleString()}件`);
    console.log(`  - ユニークレコード数: ${duplicateStats.unique_records.toLocaleString()}件`);
    console.log(`  - 重複レコード数: ${duplicateStats.duplicate_records.toLocaleString()}件`);
    console.log(`  - 重複率: ${(duplicateStats.duplicate_records/duplicateStats.total_records*100).toFixed(1)}%`);

    // 3. サンプルデータ確認
    console.log('\n📊 ステップ3: サンプルデータ確認');
    const sampleData = await bigquery.query(`
      SELECT 
        message_id,
        decoded_subject,
        decoded_sender,
        quality_score,
        encoding_type
      FROM \`viewpers.salesguard_data.completely_decoded_emails\`
      WHERE decoded_subject LIKE '%=?%'
      LIMIT 5
    `);

    console.log('  - エンコード済み件名のサンプル:');
    sampleData[0].forEach((row, index) => {
      console.log(`    ${index + 1}. ${row.decoded_subject} (品質: ${row.quality_score}点)`);
    });

    // 4. 元データとの比較
    console.log('\n📊 ステップ4: 元データとの比較');
    const originalStats = await bigquery.query(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(CASE WHEN message_subject LIKE '%=?%' THEN 1 END) as encoded_subjects,
        COUNT(CASE WHEN message_sender LIKE '%=?%' THEN 1 END) as encoded_senders
      FROM \`viewpers.salesguard_data.mbox_emails\`
      WHERE message_body IS NOT NULL
    `);

    const originalData = originalStats[0][0];
    console.log(`  - 元データ総レコード数: ${originalData.total_records.toLocaleString()}件`);
    console.log(`  - 元データエンコード済み件名: ${originalData.encoded_subjects.toLocaleString()}件`);
    console.log(`  - 元データエンコード済み送信者: ${originalData.encoded_senders.toLocaleString()}件`);

    // 5. 問題分析と解決策
    console.log('\n🎯 ステップ5: 問題分析と解決策');
    
    const decodeRate = ((stats.decoded_subjects + stats.decoded_senders) / (stats.total_records * 2)) * 100;
    console.log(`  - 現在のデコード率: ${decodeRate.toFixed(1)}%`);
    console.log(`  - 目標デコード率: 80%`);
    
    if (duplicateStats.duplicate_records > 0) {
      console.log(`  - 問題: 重複データが${duplicateStats.duplicate_records.toLocaleString()}件存在`);
      console.log(`  - 解決策: テーブルをクリアして再作成`);
    }
    
    if (decodeRate < 80) {
      console.log(`  - 問題: デコード率が低い (${decodeRate.toFixed(1)}%)`);
      console.log(`  - 解決策: デコード関数の改善が必要`);
    }

    return {
      success: true,
      totalRecords: stats.total_records,
      decodeRate,
      duplicateRecords: duplicateStats.duplicate_records,
      originalRecords: originalData.total_records
    };

  } catch (error) {
    console.error('❌ エラー:', error.message);
    return { success: false, error: error.message };
  }
}

// 実行
if (require.main === module) {
  checkCurrentTableStatus()
    .then(result => {
      if (result.success) {
        console.log('\n✅ テーブル状況分析完了！');
        console.log(`📊 総レコード数: ${result.totalRecords.toLocaleString()}件`);
        console.log(`📊 デコード率: ${result.decodeRate.toFixed(1)}%`);
        console.log(`📊 重複レコード: ${result.duplicateRecords.toLocaleString()}件`);
        console.log(`📊 元データレコード: ${result.originalRecords.toLocaleString()}件`);
      } else {
        console.log('\n❌ 分析が失敗しました:', result.error);
      }
    })
    .catch(console.error);
}

module.exports = { checkCurrentTableStatus }; 
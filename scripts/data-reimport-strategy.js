const { BigQuery } = require('@google-cloud/bigquery');

const bigquery = new BigQuery({
  projectId: 'viewpers'
});

// データ入れ直し戦略
async function analyzeDataReimportStrategy() {
  try {
    console.log('🔍 データ入れ直し戦略を分析中...\n');

    // 1. 現在のデータ状況を分析
    console.log('📊 現在のデータ状況:');
    const currentStats = await bigquery.query(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(CASE WHEN decoded_sender NOT LIKE '%=?%' THEN 1 END) as decoded_senders,
        COUNT(CASE WHEN decoded_subject NOT LIKE '%=?%' THEN 1 END) as decoded_subjects,
        COUNT(CASE WHEN decoded_body NOT LIKE '%<email.message.Message object%' THEN 1 END) as decoded_bodies,
        AVG(quality_score) as avg_quality
      FROM \`viewpers.salesguard_data.japanese_decoded_emails\`
    `);

    const stats = currentStats[0][0];
    console.log(`  - 総レコード数: ${stats.total_records.toLocaleString()}件`);
    console.log(`  - デコード済み送信者: ${stats.decoded_senders.toLocaleString()}件 (${(stats.decoded_senders/stats.total_records*100).toFixed(1)}%)`);
    console.log(`  - デコード済み件名: ${stats.decoded_subjects.toLocaleString()}件 (${(stats.decoded_subjects/stats.total_records*100).toFixed(1)}%)`);
    console.log(`  - デコード済み本文: ${stats.decoded_bodies.toLocaleString()}件 (${(stats.decoded_bodies/stats.total_records*100).toFixed(1)}%)`);
    console.log(`  - 平均品質スコア: ${stats.avg_quality.toFixed(1)}点\n`);

    // 2. 元データの状況を確認
    console.log('📧 元データ（mbox_emails）の状況:');
    const originalStats = await bigquery.query(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(CASE WHEN message_body IS NOT NULL THEN 1 END) as has_body,
        COUNT(CASE WHEN subject IS NOT NULL THEN 1 END) as has_subject,
        COUNT(CASE WHEN sender IS NOT NULL THEN 1 END) as has_sender
      FROM \`viewpers.salesguard_data.mbox_emails\`
    `);

    const original = originalStats[0][0];
    console.log(`  - 総レコード数: ${original.total_records.toLocaleString()}件`);
    console.log(`  - 本文あり: ${original.has_body.toLocaleString()}件 (${(original.has_body/original.total_records*100).toFixed(1)}%)`);
    console.log(`  - 件名あり: ${original.has_subject.toLocaleString()}件 (${(original.has_subject/original.total_records*100).toFixed(1)}%)`);
    console.log(`  - 送信者あり: ${original.has_sender.toLocaleString()}件 (${(original.has_sender/original.total_records*100).toFixed(1)}%)\n`);

    // 3. 推奨戦略
    console.log('💡 推奨戦略:');
    
    if (stats.decoded_senders/stats.total_records < 0.3) {
      console.log('  ✅ データ入れ直しを推奨');
      console.log('    - 現在のデコード品質が低い（送信者デコード率: ' + (stats.decoded_senders/stats.total_records*100).toFixed(1) + '%）');
      console.log('    - 元データが十分にある（' + original.total_records.toLocaleString() + '件）');
      console.log('    - 完全なデコード処理で品質向上が期待できる');
    } else {
      console.log('  ⚠️ 部分的な修正を推奨');
      console.log('    - 現在のデコード品質は許容範囲');
      console.log('    - 問題のあるレコードのみ修正');
    }

    // 4. 実装手順
    console.log('\n📋 実装手順:');
    console.log('  1. 元データ（mbox_emails）から完全デコード処理');
    console.log('  2. 新しいテーブル（completely_decoded_emails）を作成');
    console.log('  3. バッチ処理で全データを再処理');
    console.log('  4. 品質チェックと検証');
    console.log('  5. APIの更新');

    return {
      shouldReimport: stats.decoded_senders/stats.total_records < 0.3,
      currentQuality: stats.avg_quality,
      originalDataCount: original.total_records
    };

  } catch (error) {
    console.error('❌ 分析エラー:', error.message);
    throw error;
  }
}

// 実行
if (require.main === module) {
  analyzeDataReimportStrategy()
    .then(result => {
      console.log('\n🎯 結論:');
      if (result.shouldReimport) {
        console.log('  データ入れ直しを推奨します');
      } else {
        console.log('  部分的な修正で十分です');
      }
    })
    .catch(console.error);
}

module.exports = { analyzeDataReimportStrategy }; 
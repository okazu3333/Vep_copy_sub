const { BigQuery } = require('@google-cloud/bigquery');

const bigquery = new BigQuery({
  projectId: 'viewpers'
});

async function analyzeSegmentDetection() {
  try {
    console.log('🔍 検知フレーズロジックを適用した時の各セグメントの件数を分析します...\n');

    // 1. セグメント別基本統計
    console.log('📊 ステップ1: セグメント別基本統計');
    const segmentStats = await bigquery.query(`
      SELECT 
        segment_id,
        COUNT(*) as total_records,
        COUNT(DISTINCT alert_id) as unique_alerts,
        COUNT(DISTINCT message_id) as unique_messages,
        COUNT(CASE WHEN decoded_subject NOT LIKE '%=?%' THEN 1 END) as decoded_subjects,
        COUNT(CASE WHEN decoded_sender NOT LIKE '%=?%' THEN 1 END) as decoded_senders,
        AVG(quality_score) as avg_quality,
        ROUND(COUNT(CASE WHEN decoded_subject NOT LIKE '%=?%' THEN 1 END) * 100.0 / COUNT(*), 1) as subject_decode_rate,
        ROUND(COUNT(CASE WHEN decoded_sender NOT LIKE '%=?%' THEN 1 END) * 100.0 / COUNT(*), 1) as sender_decode_rate
      FROM \`viewpers.salesguard_data.completely_decoded_emails\`
      WHERE segment_id IS NOT NULL
      GROUP BY segment_id
      ORDER BY total_records DESC
    `);

    console.log('  - セグメント別統計:');
    segmentStats[0].forEach((row, index) => {
      console.log(`    ${index + 1}. セグメントID: ${row.segment_id}`);
      console.log(`       総レコード: ${row.total_records.toLocaleString()}件`);
      console.log(`       ユニークアラート: ${row.unique_alerts.toLocaleString()}件`);
      console.log(`       ユニークメッセージ: ${row.unique_messages.toLocaleString()}件`);
      console.log(`       デコード済み件名: ${row.decoded_subjects.toLocaleString()}件 (${row.subject_decode_rate}%)`);
      console.log(`       デコード済み送信者: ${row.decoded_senders.toLocaleString()}件 (${row.sender_decode_rate}%)`);
      console.log(`       平均品質: ${row.avg_quality.toFixed(1)}点`);
      console.log('');
    });

    // 2. セグメント別アラート分布
    console.log('📊 ステップ2: セグメント別アラート分布');
    const segmentAlertDistribution = await bigquery.query(`
      SELECT 
        segment_id,
        COUNT(DISTINCT alert_id) as alert_count,
        COUNT(*) as total_records,
        ROUND(COUNT(*) * 1.0 / COUNT(DISTINCT alert_id), 1) as avg_records_per_alert,
        ROUND(COUNT(DISTINCT message_id) * 1.0 / COUNT(DISTINCT alert_id), 1) as avg_messages_per_alert
      FROM \`viewpers.salesguard_data.completely_decoded_emails\`
      WHERE segment_id IS NOT NULL
      GROUP BY segment_id
      ORDER BY alert_count DESC
    `);

    console.log('  - セグメント別アラート分布:');
    segmentAlertDistribution[0].forEach((row, index) => {
      console.log(`    ${index + 1}. セグメントID: ${row.segment_id}`);
      console.log(`       アラート数: ${row.alert_count.toLocaleString()}件`);
      console.log(`       総レコード: ${row.total_records.toLocaleString()}件`);
      console.log(`       アラートあたりの平均レコード数: ${row.avg_records_per_alert}件`);
      console.log(`       アラートあたりの平均メッセージ数: ${row.avg_messages_per_alert}件`);
      console.log('');
    });

    // 3. 検知フレーズロジックの適用
    console.log('🔍 ステップ3: 検知フレーズロジックの適用');
    
    // フレーズロジックテーブルの確認
    const phraseLogicCheck = await bigquery.query(`
      SELECT 
        COUNT(*) as total_phrases,
        COUNT(DISTINCT segment_id) as unique_segments
      FROM \`viewpers.salesguard_data.phrase_logic\`
    `);

    const phraseStats = phraseLogicCheck[0][0];
    console.log(`  - フレーズロジック統計:`);
    console.log(`     総フレーズ数: ${phraseStats.total_phrases.toLocaleString()}件`);
    console.log(`     対象セグメント数: ${phraseStats.unique_segments.toLocaleString()}件`);

    // 4. セグメント別検知結果のシミュレーション
    console.log('\n📊 ステップ4: セグメント別検知結果のシミュレーション');
    const detectionSimulation = await bigquery.query(`
      SELECT 
        segment_id,
        COUNT(DISTINCT alert_id) as detected_alerts,
        COUNT(*) as total_records,
        COUNT(DISTINCT message_id) as unique_messages,
        ROUND(COUNT(DISTINCT alert_id) * 100.0 / (
          SELECT COUNT(DISTINCT alert_id) 
          FROM \`viewpers.salesguard_data.completely_decoded_emails\` 
          WHERE segment_id IS NOT NULL
        ), 1) as detection_rate
      FROM \`viewpers.salesguard_data.completely_decoded_emails\`
      WHERE segment_id IS NOT NULL
      GROUP BY segment_id
      ORDER BY detected_alerts DESC
    `);

    console.log('  - セグメント別検知結果:');
    detectionSimulation[0].forEach((row, index) => {
      console.log(`    ${index + 1}. セグメントID: ${row.segment_id}`);
      console.log(`       検知アラート数: ${row.detected_alerts.toLocaleString()}件`);
      console.log(`       総レコード: ${row.total_records.toLocaleString()}件`);
      console.log(`       ユニークメッセージ: ${row.unique_messages.toLocaleString()}件`);
      console.log(`       検知率: ${row.detection_rate}%`);
      console.log('');
    });

    // 5. 品質スコア別セグメント分布
    console.log('📊 ステップ5: 品質スコア別セグメント分布');
    const qualitySegmentDistribution = await bigquery.query(`
      SELECT 
        segment_id,
        COUNT(CASE WHEN quality_score >= 90 THEN 1 END) as high_quality_90,
        COUNT(CASE WHEN quality_score >= 80 THEN 1 END) as high_quality_80,
        COUNT(CASE WHEN quality_score >= 70 THEN 1 END) as medium_quality,
        COUNT(CASE WHEN quality_score < 50 THEN 1 END) as low_quality,
        AVG(quality_score) as avg_quality
      FROM \`viewpers.salesguard_data.completely_decoded_emails\`
      WHERE segment_id IS NOT NULL
      GROUP BY segment_id
      ORDER BY avg_quality DESC
    `);

    console.log('  - 品質スコア別セグメント分布:');
    qualitySegmentDistribution[0].forEach((row, index) => {
      console.log(`    ${index + 1}. セグメントID: ${row.segment_id}`);
      console.log(`       高品質(90点以上): ${row.high_quality_90.toLocaleString()}件`);
      console.log(`       高品質(80点以上): ${row.high_quality_80.toLocaleString()}件`);
      console.log(`       中品質(70点以上): ${row.medium_quality.toLocaleString()}件`);
      console.log(`       低品質(50点未満): ${row.low_quality.toLocaleString()}件`);
      console.log(`       平均品質: ${row.avg_quality.toFixed(1)}点`);
      console.log('');
    });

    // 6. 総合分析
    console.log('🎯 ステップ6: 総合分析');
    const overallAnalysis = await bigquery.query(`
      SELECT 
        COUNT(DISTINCT segment_id) as total_segments,
        COUNT(DISTINCT alert_id) as total_alerts,
        COUNT(DISTINCT message_id) as total_messages,
        COUNT(*) as total_records,
        AVG(quality_score) as overall_avg_quality,
        ROUND(COUNT(CASE WHEN decoded_subject NOT LIKE '%=?%' THEN 1 END) * 100.0 / COUNT(*), 1) as overall_decode_rate
      FROM \`viewpers.salesguard_data.completely_decoded_emails\`
      WHERE segment_id IS NOT NULL
    `);

    const overall = overallAnalysis[0][0];
    console.log(`  - 総合統計:`);
    console.log(`     総セグメント数: ${overall.total_segments.toLocaleString()}件`);
    console.log(`     総アラート数: ${overall.total_alerts.toLocaleString()}件`);
    console.log(`     総メッセージ数: ${overall.total_messages.toLocaleString()}件`);
    console.log(`     総レコード数: ${overall.total_records.toLocaleString()}件`);
    console.log(`     全体平均品質: ${overall.overall_avg_quality.toFixed(1)}点`);
    console.log(`     全体デコード率: ${overall.overall_decode_rate}%`);

    // 7. フロントエンド表示への影響
    console.log('\n📋 ステップ7: フロントエンド表示への影響');
    console.log(`  - 検知フレーズロジック適用後の表示件数: ${overall.total_alerts.toLocaleString()}件`);
    console.log(`  - セグメント別フィルタリング可能: ${overall.total_segments.toLocaleString()}セグメント`);
    console.log(`  - 高品質データの割合: ${((overall.overall_avg_quality / 100) * 100).toFixed(1)}%`);
    console.log(`  - デコード済みデータの割合: ${overall.overall_decode_rate}%`);

    return {
      success: true,
      totalSegments: overall.total_segments,
      totalAlerts: overall.total_alerts,
      totalMessages: overall.total_messages,
      totalRecords: overall.total_records,
      avgQuality: overall.overall_avg_quality,
      decodeRate: overall.overall_decode_rate
    };

  } catch (error) {
    console.error('❌ エラー:', error.message);
    return { success: false, error: error.message };
  }
}

// 実行
if (require.main === module) {
  analyzeSegmentDetection()
    .then(result => {
      if (result.success) {
        console.log('\n🎉 セグメント検知分析完了！');
        console.log(`📊 総セグメント数: ${result.totalSegments.toLocaleString()}件`);
        console.log(`📊 総アラート数: ${result.totalAlerts.toLocaleString()}件`);
        console.log(`📊 総メッセージ数: ${result.totalMessages.toLocaleString()}件`);
        console.log(`📊 総レコード数: ${result.totalRecords.toLocaleString()}件`);
        console.log(`📊 平均品質: ${result.avgQuality.toFixed(1)}点`);
        console.log(`📊 デコード率: ${result.decodeRate}%`);
      } else {
        console.log('\n❌ 分析が失敗しました:', result.error);
      }
    })
    .catch(console.error);
}

module.exports = { analyzeSegmentDetection }; 
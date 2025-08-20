const { BigQuery } = require('@google-cloud/bigquery');

const bigquery = new BigQuery({
  projectId: 'viewpers'
});

async function analyzeSegmentDetectionCorrected() {
  try {
    console.log('🔍 検知フレーズロジックを適用した時の各セグメントの件数を分析します...\n');

    // 1. フレーズロジックの基本統計
    console.log('📊 ステップ1: フレーズロジックの基本統計');
    const phraseLogicStats = await bigquery.query(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(DISTINCT category) as unique_categories,
        COUNT(DISTINCT priority) as unique_priorities
      FROM \`viewpers.salesguard_data.phrase_logic\`
    `);

    const phraseStats = phraseLogicStats[0][0];
    console.log(`  - 総フレーズロジック数: ${phraseStats.total_records.toLocaleString()}件`);
    console.log(`  - ユニークカテゴリ数: ${phraseStats.unique_categories.toLocaleString()}件`);
    console.log(`  - ユニーク優先度数: ${phraseStats.unique_priorities.toLocaleString()}件`);

    // 2. カテゴリ別統計
    console.log('\n📊 ステップ2: カテゴリ別統計');
    const categoryStats = await bigquery.query(`
      SELECT 
        category,
        priority,
        delay,
        description,
        phrases
      FROM \`viewpers.salesguard_data.phrase_logic\`
      ORDER BY category, priority
    `);

    console.log('  - カテゴリ別フレーズロジック:');
    categoryStats[0].forEach((row, index) => {
      console.log(`    ${index + 1}. カテゴリ: ${row.category}`);
      console.log(`       優先度: ${row.priority}`);
      console.log(`       遅延: ${row.delay}日`);
      console.log(`       説明: ${row.description}`);
      console.log(`       フレーズ: ${row.phrases}`);
      console.log('');
    });

    // 3. セグメント別基本統計（completely_decoded_emails）
    console.log('📊 ステップ3: セグメント別基本統計');
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

    // 4. 検知シミュレーション（フレーズロジックを適用）
    console.log('🔍 ステップ4: 検知シミュレーション');
    
    // 各カテゴリのフレーズで検知される件数をシミュレーション
    const detectionSimulation = await bigquery.query(`
      SELECT 
        '解約' as category,
        COUNT(DISTINCT alert_id) as detected_alerts,
        COUNT(*) as total_records,
        ROUND(COUNT(DISTINCT alert_id) * 100.0 / (
          SELECT COUNT(DISTINCT alert_id) 
          FROM \`viewpers.salesguard_data.completely_decoded_emails\` 
          WHERE segment_id IS NOT NULL
        ), 1) as detection_rate
      FROM \`viewpers.salesguard_data.completely_decoded_emails\`
      WHERE segment_id IS NOT NULL
        AND (
          LOWER(decoded_subject) LIKE '%契約を見直したい%'
          OR LOWER(decoded_subject) LIKE '%他社も検討%'
          OR LOWER(decoded_subject) LIKE '%料金プランの変更%'
          OR LOWER(decoded_subject) LIKE '%サービスの利用を終了%'
          OR LOWER(decoded_subject) LIKE '%解約を検討%'
        )
    `);

    console.log('  - 解約カテゴリの検知結果:');
    if (detectionSimulation[0].length > 0) {
      const result = detectionSimulation[0][0];
      console.log(`     検知アラート数: ${result.detected_alerts.toLocaleString()}件`);
      console.log(`     総レコード: ${result.total_records.toLocaleString()}件`);
      console.log(`     検知率: ${result.detection_rate}%`);
    } else {
      console.log('     検知結果なし');
    }

    // 5. 品質スコア別分布
    console.log('\n📊 ステップ5: 品質スコア別分布');
    const qualityDistribution = await bigquery.query(`
      SELECT 
        CASE 
          WHEN quality_score >= 90 THEN '90-100点'
          WHEN quality_score >= 80 THEN '80-89点'
          WHEN quality_score >= 70 THEN '70-79点'
          WHEN quality_score >= 60 THEN '60-69点'
          WHEN quality_score >= 50 THEN '50-59点'
          ELSE '50点未満'
        END as quality_range,
        COUNT(*) as record_count,
        COUNT(DISTINCT alert_id) as alert_count,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 1) as percentage
      FROM \`viewpers.salesguard_data.completely_decoded_emails\`
      WHERE segment_id IS NOT NULL
      GROUP BY quality_range
      ORDER BY 
        CASE quality_range
          WHEN '90-100点' THEN 1
          WHEN '80-89点' THEN 2
          WHEN '70-79点' THEN 3
          WHEN '60-69点' THEN 4
          WHEN '50-59点' THEN 5
          ELSE 6
        END
    `);

    console.log('  - 品質スコア別分布:');
    qualityDistribution[0].forEach((row, index) => {
      console.log(`    ${index + 1}. ${row.quality_range}: ${row.record_count.toLocaleString()}レコード (${row.alert_count.toLocaleString()}アラート, ${row.percentage}%)`);
    });

    // 6. 総合分析
    console.log('\n🎯 ステップ6: 総合分析');
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
    console.log(`  - フレーズロジックカテゴリ数: ${phraseStats.unique_categories.toLocaleString()}件`);

    return {
      success: true,
      totalSegments: overall.total_segments,
      totalAlerts: overall.total_alerts,
      totalMessages: overall.total_messages,
      totalRecords: overall.total_records,
      avgQuality: overall.overall_avg_quality,
      decodeRate: overall.overall_decode_rate,
      phraseCategories: phraseStats.unique_categories
    };

  } catch (error) {
    console.error('❌ エラー:', error.message);
    return { success: false, error: error.message };
  }
}

// 実行
if (require.main === module) {
  analyzeSegmentDetectionCorrected()
    .then(result => {
      if (result.success) {
        console.log('\n🎉 セグメント検知分析完了！');
        console.log(`📊 総セグメント数: ${result.totalSegments.toLocaleString()}件`);
        console.log(`📊 総アラート数: ${result.totalAlerts.toLocaleString()}件`);
        console.log(`📊 総メッセージ数: ${result.totalMessages.toLocaleString()}件`);
        console.log(`📊 総レコード数: ${result.totalRecords.toLocaleString()}件`);
        console.log(`📊 平均品質: ${result.avgQuality.toFixed(1)}点`);
        console.log(`📊 デコード率: ${result.decodeRate}%`);
        console.log(`📊 フレーズロジックカテゴリ数: ${result.phraseCategories.toLocaleString()}件`);
      } else {
        console.log('\n❌ 分析が失敗しました:', result.error);
      }
    })
    .catch(console.error);
}

module.exports = { analyzeSegmentDetectionCorrected }; 
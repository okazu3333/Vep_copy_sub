const { BigQuery } = require('@google-cloud/bigquery');

const bigquery = new BigQuery({
  projectId: 'viewpers'
});

async function analyzeAllSegments() {
  try {
    console.log('🔍 全セグメントの検知シミュレーションを実行します...\n');

    // 現在のフレーズロジックを取得
    const phraseLogicQuery = `
      SELECT 
        category,
        priority,
        delay,
        description,
        phrases
      FROM \`viewpers.salesguard_data.phrase_logic\`
      ORDER BY category
    `;

    const [phraseLogicResult] = await bigquery.query({ query: phraseLogicQuery });
    const phraseLogic = phraseLogicResult;

    console.log('📊 現在のフレーズロジック:');
    phraseLogic.forEach((logic, index) => {
      console.log(`  ${index + 1}. カテゴリ: ${logic.category}`);
      console.log(`     優先度: ${logic.priority}`);
      console.log(`     遅延: ${logic.delay}日`);
      console.log(`     説明: ${logic.description}`);
      console.log(`     フレーズ: ${logic.phrases}`);
      console.log('');
    });

    // 各セグメントの検知シミュレーション
    console.log('🎯 各セグメントの検知シミュレーション:');
    
    for (const logic of phraseLogic) {
      const phrases = JSON.parse(logic.phrases);
      const phraseConditions = phrases.map(phrase => 
        `LOWER(decoded_subject) LIKE '%${phrase.toLowerCase()}%' OR LOWER(decoded_body) LIKE '%${phrase.toLowerCase()}%'`
      ).join(' OR ');

      const detectionQuery = `
        SELECT 
          COUNT(*) as detected_count,
          COUNT(DISTINCT message_id) as unique_messages,
          AVG(quality_score) as avg_quality,
          COUNT(CASE WHEN quality_score >= 80 THEN 1 END) as high_quality_count
        FROM \`viewpers.salesguard_data.completely_decoded_emails\`
        WHERE (${phraseConditions})
      `;

      try {
        const [detectionResult] = await bigquery.query({ query: detectionQuery });
        const detection = detectionResult[0];

        console.log(`\n📊 ${logic.category}セグメント:`);
        console.log(`  - 検知件数: ${detection.detected_count.toLocaleString()}件`);
        console.log(`  - ユニークメッセージ: ${detection.unique_messages.toLocaleString()}件`);
        console.log(`  - 平均品質: ${detection.avg_quality ? detection.avg_quality.toFixed(1) : 'N/A'}点`);
        console.log(`  - 高品質件数: ${detection.high_quality_count.toLocaleString()}件`);
        console.log(`  - 検知率: ${((detection.detected_count / 771705) * 100).toFixed(3)}%`);
        
        // サンプルデータを取得
        const sampleQuery = `
          SELECT 
            decoded_subject,
            decoded_body,
            quality_score,
            created_at
          FROM \`viewpers.salesguard_data.completely_decoded_emails\`
          WHERE (${phraseConditions})
          LIMIT 3
        `;

        const [sampleResult] = await bigquery.query({ query: sampleQuery });
        if (sampleResult.length > 0) {
          console.log(`  - サンプルデータ:`);
          sampleResult.forEach((sample, index) => {
            console.log(`    ${index + 1}. 件名: ${sample.decoded_subject?.substring(0, 50)}...`);
            console.log(`       本文: ${sample.decoded_body?.substring(0, 100)}...`);
            console.log(`       品質: ${sample.quality_score}点`);
          });
        }
      } catch (error) {
        console.log(`  ❌ ${logic.category}セグメントの分析でエラー: ${error.message}`);
      }
    }

    // 総合統計
    console.log('\n📈 総合統計:');
    const totalQuery = `
      SELECT 
        COUNT(*) as total_records,
        COUNT(DISTINCT message_id) as unique_messages,
        AVG(quality_score) as avg_quality
      FROM \`viewpers.salesguard_data.completely_decoded_emails\`
    `;

    const [totalResult] = await bigquery.query({ query: totalQuery });
    const total = totalResult[0];

    console.log(`  - 総レコード数: ${total.total_records.toLocaleString()}件`);
    console.log(`  - ユニークメッセージ: ${total.unique_messages.toLocaleString()}件`);
    console.log(`  - 平均品質: ${total.avg_quality.toFixed(1)}点`);

    return {
      success: true,
      phraseLogic: phraseLogic,
      totalRecords: total.total_records
    };

  } catch (error) {
    console.error('❌ エラー:', error.message);
    return { success: false, error: error.message };
  }
}

// 実行
if (require.main === module) {
  analyzeAllSegments()
    .then(result => {
      if (result.success) {
        console.log('\n🎉 全セグメント分析完了！');
      } else {
        console.log('\n❌ 分析失敗:', result.error);
      }
    })
    .catch(error => {
      console.error('❌ 実行エラー:', error);
    });
}

module.exports = { analyzeAllSegments }; 
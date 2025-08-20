const { BigQuery } = require('@google-cloud/bigquery');

const bigquery = new BigQuery({
  projectId: 'viewpers'
});

async function analyzePhraseCategoryDetection() {
  try {
    console.log('🔍 6つのフレーズカテゴリがそれぞれ何件当てはまるかを分析します...\n');

    // 1. 各カテゴリのフレーズ定義を取得
    console.log('📊 ステップ1: フレーズカテゴリの定義確認');
    const phraseDefinitions = await bigquery.query(`
      SELECT 
        category,
        phrases,
        priority,
        delay,
        description
      FROM \`viewpers.salesguard_data.phrase_logic\`
      ORDER BY category
    `);

    console.log('  - フレーズカテゴリ定義:');
    phraseDefinitions[0].forEach((row, index) => {
      console.log(`    ${index + 1}. カテゴリ: ${row.category}`);
      console.log(`       優先度: ${row.priority}`);
      console.log(`       遅延: ${row.delay}日`);
      console.log(`       説明: ${row.description}`);
      console.log(`       フレーズ: ${row.phrases}`);
      console.log('');
    });

    // 2. 各カテゴリの検知結果を分析
    console.log('🔍 ステップ2: 各カテゴリの検知結果分析');

    // 解約カテゴリ
    console.log('  - 解約カテゴリの検知結果:');
    const cancelDetection = await bigquery.query(`
      SELECT 
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
        AND (
          LOWER(decoded_subject) LIKE '%契約を見直したい%'
          OR LOWER(decoded_subject) LIKE '%他社も検討%'
          OR LOWER(decoded_subject) LIKE '%料金プランの変更%'
          OR LOWER(decoded_subject) LIKE '%サービスの利用を終了%'
          OR LOWER(decoded_subject) LIKE '%解約を検討%'
        )
    `);

    if (cancelDetection[0].length > 0) {
      const result = cancelDetection[0][0];
      console.log(`     検知アラート数: ${result.detected_alerts.toLocaleString()}件`);
      console.log(`     総レコード: ${result.total_records.toLocaleString()}件`);
      console.log(`     ユニークメッセージ: ${result.unique_messages.toLocaleString()}件`);
      console.log(`     検知率: ${result.detection_rate}%`);
    } else {
      console.log('     検知結果なし');
    }

    // 競合カテゴリ
    console.log('\n  - 競合カテゴリの検知結果:');
    const competitorDetection = await bigquery.query(`
      SELECT 
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
        AND (
          LOWER(decoded_subject) LIKE '%競合の提案%'
          OR LOWER(decoded_subject) LIKE '%他社と比較して%'
          OR LOWER(decoded_subject) LIKE '%a社と比較検討%'
          OR LOWER(decoded_subject) LIKE '%御社の優位性%'
        )
    `);

    if (competitorDetection[0].length > 0) {
      const result = competitorDetection[0][0];
      console.log(`     検知アラート数: ${result.detected_alerts.toLocaleString()}件`);
      console.log(`     総レコード: ${result.total_records.toLocaleString()}件`);
      console.log(`     ユニークメッセージ: ${result.unique_messages.toLocaleString()}件`);
      console.log(`     検知率: ${result.detection_rate}%`);
    } else {
      console.log('     検知結果なし');
    }

    // エスカレーションカテゴリ
    console.log('\n  - エスカレーションカテゴリの検知結果:');
    const escalationDetection = await bigquery.query(`
      SELECT 
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
        AND (
          LOWER(decoded_subject) LIKE '%責任者の方お願いします%'
          OR LOWER(decoded_subject) LIKE '%話になりません%'
          OR LOWER(decoded_subject) LIKE '%正式に抗議します%'
          OR LOWER(decoded_subject) LIKE '%納得いきません%'
        )
    `);

    if (escalationDetection[0].length > 0) {
      const result = escalationDetection[0][0];
      console.log(`     検知アラート数: ${result.detected_alerts.toLocaleString()}件`);
      console.log(`     総レコード: ${result.total_records.toLocaleString()}件`);
      console.log(`     ユニークメッセージ: ${result.unique_messages.toLocaleString()}件`);
      console.log(`     検知率: ${result.detection_rate}%`);
    } else {
      console.log('     検知結果なし');
    }

    // 遅延・フォローアップカテゴリ
    console.log('\n  - 遅延・フォローアップカテゴリの検知結果:');
    const delayDetection = await bigquery.query(`
      SELECT 
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
        AND (
          LOWER(decoded_subject) LIKE '%どうなっていますでしょうか%'
          OR LOWER(decoded_subject) LIKE '%進捗はいかがですか%'
          OR LOWER(decoded_subject) LIKE '%まだでしょうか%'
          OR LOWER(decoded_subject) LIKE '%先日お問い合わせした件%'
        )
    `);

    if (delayDetection[0].length > 0) {
      const result = delayDetection[0][0];
      console.log(`     検知アラート数: ${result.detected_alerts.toLocaleString()}件`);
      console.log(`     総レコード: ${result.total_records.toLocaleString()}件`);
      console.log(`     ユニークメッセージ: ${result.unique_messages.toLocaleString()}件`);
      console.log(`     検知率: ${result.detection_rate}%`);
    } else {
      console.log('     検知結果なし');
    }

    // 懸念・疑念カテゴリ
    console.log('\n  - 懸念・疑念カテゴリの検知結果:');
    const concernDetection = await bigquery.query(`
      SELECT 
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
        AND (
          LOWER(decoded_subject) LIKE '%少し懸念しております%'
          OR LOWER(decoded_subject) LIKE '%認識に齟齬があるようです%'
          OR LOWER(decoded_subject) LIKE '%本当に大丈夫でしょうか%'
          OR LOWER(decoded_subject) LIKE '%少し不安です%'
        )
    `);

    if (concernDetection[0].length > 0) {
      const result = concernDetection[0][0];
      console.log(`     検知アラート数: ${result.detected_alerts.toLocaleString()}件`);
      console.log(`     総レコード: ${result.total_records.toLocaleString()}件`);
      console.log(`     ユニークメッセージ: ${result.unique_messages.toLocaleString()}件`);
      console.log(`     検知率: ${result.detection_rate}%`);
    } else {
      console.log('     検知結果なし');
    }

    // 期待値の相違カテゴリ
    console.log('\n  - 期待値の相違カテゴリの検知結果:');
    const expectationDetection = await bigquery.query(`
      SELECT 
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
        AND (
          LOWER(decoded_subject) LIKE '%お話と違うようですが%'
          OR LOWER(decoded_subject) LIKE '%できると聞いていました%'
          OR LOWER(decoded_subject) LIKE '%契約にはありませんが%'
          OR LOWER(decoded_subject) LIKE '%スコープ外の認識です%'
        )
    `);

    if (expectationDetection[0].length > 0) {
      const result = expectationDetection[0][0];
      console.log(`     検知アラート数: ${result.detected_alerts.toLocaleString()}件`);
      console.log(`     総レコード: ${result.total_records.toLocaleString()}件`);
      console.log(`     ユニークメッセージ: ${result.unique_messages.toLocaleString()}件`);
      console.log(`     検知率: ${result.detection_rate}%`);
    } else {
      console.log('     検知結果なし');
    }

    // 3. 総合分析
    console.log('\n📊 ステップ3: 総合分析');
    const overallStats = await bigquery.query(`
      SELECT 
        COUNT(DISTINCT alert_id) as total_alerts,
        COUNT(*) as total_records
      FROM \`viewpers.salesguard_data.completely_decoded_emails\`
      WHERE segment_id IS NOT NULL
    `);

    const overall = overallStats[0][0];
    console.log(`  - 総アラート数: ${overall.total_alerts.toLocaleString()}件`);
    console.log(`  - 総レコード数: ${overall.total_records.toLocaleString()}件`);

    // 4. サンプル検知結果
    console.log('\n📝 ステップ4: サンプル検知結果');
    
    // 解約カテゴリのサンプル
    const cancelSamples = await bigquery.query(`
      SELECT 
        alert_id,
        decoded_subject,
        quality_score
      FROM \`viewpers.salesguard_data.completely_decoded_emails\`
      WHERE segment_id IS NOT NULL
        AND (
          LOWER(decoded_subject) LIKE '%契約を見直したい%'
          OR LOWER(decoded_subject) LIKE '%他社も検討%'
          OR LOWER(decoded_subject) LIKE '%料金プランの変更%'
          OR LOWER(decoded_subject) LIKE '%サービスの利用を終了%'
          OR LOWER(decoded_subject) LIKE '%解約を検討%'
        )
      LIMIT 5
    `);

    if (cancelSamples[0].length > 0) {
      console.log('  - 解約カテゴリのサンプル:');
      cancelSamples[0].forEach((row, index) => {
        console.log(`    ${index + 1}. ${row.decoded_subject} (品質: ${row.quality_score}点)`);
      });
    }

    return {
      success: true,
      totalAlerts: overall.total_alerts,
      totalRecords: overall.total_records
    };

  } catch (error) {
    console.error('❌ エラー:', error.message);
    return { success: false, error: error.message };
  }
}

// 実行
if (require.main === module) {
  analyzePhraseCategoryDetection()
    .then(result => {
      if (result.success) {
        console.log('\n🎉 フレーズカテゴリ検知分析完了！');
        console.log(`📊 総アラート数: ${result.totalAlerts.toLocaleString()}件`);
        console.log(`📊 総レコード数: ${result.totalRecords.toLocaleString()}件`);
      } else {
        console.log('\n❌ 分析が失敗しました:', result.error);
      }
    })
    .catch(console.error);
}

module.exports = { analyzePhraseCategoryDetection }; 
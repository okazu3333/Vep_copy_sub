const { BigQuery } = require('@google-cloud/bigquery');

const bigquery = new BigQuery({
  projectId: 'viewpers'
});

async function analyzeRecordsVsAlerts() {
  try {
    console.log('🔍 レコード数とアラート数の関係を分析します...\n');

    // 1. 基本統計
    console.log('📊 ステップ1: 基本統計');
    const basicStats = await bigquery.query(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(DISTINCT alert_id) as total_alerts,
        COUNT(DISTINCT message_id) as unique_messages,
        ROUND(COUNT(*) * 1.0 / COUNT(DISTINCT alert_id), 1) as avg_records_per_alert,
        ROUND(COUNT(*) * 1.0 / COUNT(DISTINCT message_id), 1) as avg_records_per_message
      FROM \`viewpers.salesguard_data.completely_decoded_emails\`
      WHERE alert_id IS NOT NULL
    `);

    const stats = basicStats[0][0];
    console.log(`  - 総レコード数: ${stats.total_records.toLocaleString()}件`);
    console.log(`  - 総アラート数: ${stats.total_alerts.toLocaleString()}件`);
    console.log(`  - ユニークメッセージ数: ${stats.unique_messages.toLocaleString()}件`);
    console.log(`  - アラートあたりの平均レコード数: ${stats.avg_records_per_alert}件`);
    console.log(`  - メッセージあたりの平均レコード数: ${stats.avg_records_per_message}件`);

    // 2. アラート別レコード数分布
    console.log('\n📊 ステップ2: アラート別レコード数分布');
    const alertRecordDistribution = await bigquery.query(`
      SELECT 
        CASE 
          WHEN record_count >= 1000 THEN '1000件以上'
          WHEN record_count >= 500 THEN '500-999件'
          WHEN record_count >= 100 THEN '100-499件'
          WHEN record_count >= 50 THEN '50-99件'
          WHEN record_count >= 10 THEN '10-49件'
          ELSE '1-9件'
        END as record_range,
        COUNT(*) as alert_count,
        SUM(record_count) as total_records_in_range,
        ROUND(AVG(record_count), 1) as avg_records_per_alert
      FROM (
        SELECT 
          alert_id,
          COUNT(*) as record_count
        FROM \`viewpers.salesguard_data.completely_decoded_emails\`
        WHERE alert_id IS NOT NULL
        GROUP BY alert_id
      )
      GROUP BY record_range
      ORDER BY 
        CASE record_range
          WHEN '1000件以上' THEN 1
          WHEN '500-999件' THEN 2
          WHEN '100-499件' THEN 3
          WHEN '50-99件' THEN 4
          WHEN '10-49件' THEN 5
          ELSE 6
        END
    `);

    console.log('  - アラート別レコード数分布:');
    alertRecordDistribution[0].forEach((row, index) => {
      console.log(`    ${index + 1}. ${row.record_range}: ${row.alert_count.toLocaleString()}アラート (${row.total_records_in_range.toLocaleString()}レコード, 平均${row.avg_records_per_alert}件)`);
    });

    // 3. 重複メッセージの分析
    console.log('\n📊 ステップ3: 重複メッセージの分析');
    const duplicateAnalysis = await bigquery.query(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(DISTINCT message_id) as unique_messages,
        COUNT(*) - COUNT(DISTINCT message_id) as duplicate_records,
        ROUND((COUNT(*) - COUNT(DISTINCT message_id)) * 100.0 / COUNT(*), 1) as duplicate_rate,
        ROUND(COUNT(*) * 1.0 / COUNT(DISTINCT message_id), 1) as avg_copies_per_message
      FROM \`viewpers.salesguard_data.completely_decoded_emails\`
      WHERE alert_id IS NOT NULL
    `);

    const duplicateStats = duplicateAnalysis[0][0];
    console.log(`  - 総レコード数: ${duplicateStats.total_records.toLocaleString()}件`);
    console.log(`  - ユニークメッセージ数: ${duplicateStats.unique_messages.toLocaleString()}件`);
    console.log(`  - 重複レコード数: ${duplicateStats.duplicate_records.toLocaleString()}件`);
    console.log(`  - 重複率: ${duplicateStats.duplicate_rate}%`);
    console.log(`  - メッセージあたりの平均コピー数: ${duplicateStats.avg_copies_per_message}件`);

    // 4. アラートとメッセージの関係
    console.log('\n📊 ステップ4: アラートとメッセージの関係');
    const alertMessageRelation = await bigquery.query(`
      SELECT 
        COUNT(DISTINCT alert_id) as total_alerts,
        COUNT(DISTINCT message_id) as total_messages,
        COUNT(DISTINCT CONCAT(alert_id, '_', message_id)) as unique_alert_message_pairs,
        ROUND(COUNT(DISTINCT message_id) * 1.0 / COUNT(DISTINCT alert_id), 1) as avg_messages_per_alert,
        ROUND(COUNT(DISTINCT alert_id) * 1.0 / COUNT(DISTINCT message_id), 1) as avg_alerts_per_message
      FROM \`viewpers.salesguard_data.completely_decoded_emails\`
      WHERE alert_id IS NOT NULL
    `);

    const relationStats = alertMessageRelation[0][0];
    console.log(`  - 総アラート数: ${relationStats.total_alerts.toLocaleString()}件`);
    console.log(`  - 総メッセージ数: ${relationStats.total_messages.toLocaleString()}件`);
    console.log(`  - ユニークアラート-メッセージペア: ${relationStats.unique_alert_message_pairs.toLocaleString()}件`);
    console.log(`  - アラートあたりの平均メッセージ数: ${relationStats.avg_messages_per_alert}件`);
    console.log(`  - メッセージあたりの平均アラート数: ${relationStats.avg_alerts_per_message}件`);

    // 5. サンプルアラートの詳細
    console.log('\n📝 ステップ5: サンプルアラートの詳細');
    const sampleAlerts = await bigquery.query(`
      SELECT 
        alert_id,
        COUNT(*) as total_records,
        COUNT(DISTINCT message_id) as unique_messages,
        ROUND(COUNT(*) * 1.0 / COUNT(DISTINCT message_id), 1) as avg_copies_per_message,
        COUNT(CASE WHEN decoded_subject NOT LIKE '%=?%' THEN 1 END) as decoded_subjects,
        AVG(quality_score) as avg_quality
      FROM \`viewpers.salesguard_data.completely_decoded_emails\`
      WHERE alert_id IS NOT NULL
      GROUP BY alert_id
      ORDER BY COUNT(*) DESC
      LIMIT 10
    `);

    console.log('  - レコード数が多いアラート（上位10件）:');
    sampleAlerts[0].forEach((row, index) => {
      console.log(`    ${index + 1}. アラートID: ${row.alert_id}`);
      console.log(`       総レコード: ${row.total_records.toLocaleString()}件`);
      console.log(`       ユニークメッセージ: ${row.unique_messages.toLocaleString()}件`);
      console.log(`       メッセージあたりの平均コピー数: ${row.avg_copies_per_message}件`);
      console.log(`       デコード済み件名: ${row.decoded_subjects.toLocaleString()}件`);
      console.log(`       平均品質: ${row.avg_quality.toFixed(1)}点`);
      console.log('');
    });

    // 6. 要約と解釈
    console.log('\n🎯 ステップ6: 要約と解釈');
    console.log(`  - 総レコード数: ${stats.total_records.toLocaleString()}件`);
    console.log(`  - 総アラート数: ${stats.total_alerts.toLocaleString()}件`);
    console.log(`  - ユニークメッセージ数: ${stats.unique_messages.toLocaleString()}件`);
    console.log(`  - アラートあたりの平均レコード数: ${stats.avg_records_per_alert}件`);
    console.log(`  - メッセージあたりの平均コピー数: ${duplicateStats.avg_copies_per_message}件`);
    console.log(`  - 重複率: ${duplicateStats.duplicate_rate}%`);
    
    console.log('\n  📋 解釈:');
    console.log(`    1. 1つのメッセージが複数のアラートに含まれている可能性`);
    console.log(`    2. 同じメッセージが複数回コピーされている可能性`);
    console.log(`    3. アラートあたり約${stats.avg_records_per_alert}件のレコードが存在`);
    console.log(`    4. メッセージあたり約${duplicateStats.avg_copies_per_message}件のコピーが存在`);

    return {
      success: true,
      totalRecords: stats.total_records,
      totalAlerts: stats.total_alerts,
      uniqueMessages: stats.unique_messages,
      avgRecordsPerAlert: stats.avg_records_per_alert,
      avgCopiesPerMessage: duplicateStats.avg_copies_per_message,
      duplicateRate: duplicateStats.duplicate_rate
    };

  } catch (error) {
    console.error('❌ エラー:', error.message);
    return { success: false, error: error.message };
  }
}

// 実行
if (require.main === module) {
  analyzeRecordsVsAlerts()
    .then(result => {
      if (result.success) {
        console.log('\n🎉 レコード数とアラート数の関係分析完了！');
        console.log(`📊 総レコード数: ${result.totalRecords.toLocaleString()}件`);
        console.log(`📊 総アラート数: ${result.totalAlerts.toLocaleString()}件`);
        console.log(`📊 ユニークメッセージ数: ${result.uniqueMessages.toLocaleString()}件`);
        console.log(`📊 アラートあたりの平均レコード数: ${result.avgRecordsPerAlert}件`);
        console.log(`📊 メッセージあたりの平均コピー数: ${result.avgCopiesPerMessage}件`);
        console.log(`📊 重複率: ${result.duplicateRate}%`);
      } else {
        console.log('\n❌ 分析が失敗しました:', result.error);
      }
    })
    .catch(console.error);
}

module.exports = { analyzeRecordsVsAlerts }; 
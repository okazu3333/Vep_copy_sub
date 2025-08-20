const { BigQuery } = require('@google-cloud/bigquery');

const bigquery = new BigQuery({
  projectId: 'viewpers'
});

async function checkAlertsWithDecodedData() {
  try {
    console.log('🔍 アラートの中にデコード対象が含まれている件数を確認します...\n');

    // 1. アラート別デコード状況
    console.log('📊 ステップ1: アラート別デコード状況');
    const alertDecodeStats = await bigquery.query(`
      SELECT 
        alert_id,
        COUNT(*) as total_records,
        COUNT(CASE WHEN decoded_subject NOT LIKE '%=?%' THEN 1 END) as decoded_subjects,
        COUNT(CASE WHEN decoded_sender NOT LIKE '%=?%' THEN 1 END) as decoded_senders,
        ROUND(COUNT(CASE WHEN decoded_subject NOT LIKE '%=?%' THEN 1 END) * 100.0 / COUNT(*), 1) as subject_decode_rate,
        ROUND(COUNT(CASE WHEN decoded_sender NOT LIKE '%=?%' THEN 1 END) * 100.0 / COUNT(*), 1) as sender_decode_rate,
        AVG(quality_score) as avg_quality
      FROM \`viewpers.salesguard_data.completely_decoded_emails\`
      WHERE alert_id IS NOT NULL
      GROUP BY alert_id
      ORDER BY total_records DESC
      LIMIT 20
    `);

    console.log('  - アラート別デコード状況（上位20件）:');
    alertDecodeStats[0].forEach((row, index) => {
      console.log(`    ${index + 1}. アラートID: ${row.alert_id}`);
      console.log(`       総レコード: ${row.total_records.toLocaleString()}件`);
      console.log(`       デコード済み件名: ${row.decoded_subjects.toLocaleString()}件 (${row.subject_decode_rate}%)`);
      console.log(`       デコード済み送信者: ${row.decoded_senders.toLocaleString()}件 (${row.sender_decode_rate}%)`);
      console.log(`       平均品質: ${row.avg_quality.toFixed(1)}点`);
      console.log('');
    });

    // 2. デコード対象を含むアラートの総数
    console.log('📊 ステップ2: デコード対象を含むアラートの総数');
    const alertsWithDecodedData = await bigquery.query(`
      SELECT 
        COUNT(DISTINCT alert_id) as total_alerts,
        COUNT(DISTINCT CASE WHEN decoded_subject NOT LIKE '%=?%' THEN alert_id END) as alerts_with_decoded_subjects,
        COUNT(DISTINCT CASE WHEN decoded_sender NOT LIKE '%=?%' THEN alert_id END) as alerts_with_decoded_senders,
        COUNT(DISTINCT CASE WHEN decoded_subject NOT LIKE '%=?%' OR decoded_sender NOT LIKE '%=?%' THEN alert_id END) as alerts_with_any_decoded
      FROM \`viewpers.salesguard_data.completely_decoded_emails\`
      WHERE alert_id IS NOT NULL
    `);

    const alertStats = alertsWithDecodedData[0][0];
    console.log(`  - 総アラート数: ${alertStats.total_alerts.toLocaleString()}件`);
    console.log(`  - デコード済み件名を含むアラート: ${alertStats.alerts_with_decoded_subjects.toLocaleString()}件`);
    console.log(`  - デコード済み送信者を含むアラート: ${alertStats.alerts_with_decoded_senders.toLocaleString()}件`);
    console.log(`  - デコード対象を含むアラート: ${alertStats.alerts_with_any_decoded.toLocaleString()}件`);

    // 3. デコード率別アラート分布
    console.log('\n📊 ステップ3: デコード率別アラート分布');
    const decodeRateDistribution = await bigquery.query(`
      WITH alert_decode_rates AS (
        SELECT 
          alert_id,
          COUNT(*) as total_records,
          COUNT(CASE WHEN decoded_subject NOT LIKE '%=?%' THEN 1 END) as decoded_subjects,
          ROUND(COUNT(CASE WHEN decoded_subject NOT LIKE '%=?%' THEN 1 END) * 100.0 / COUNT(*), 1) as decode_rate
        FROM \`viewpers.salesguard_data.completely_decoded_emails\`
        WHERE alert_id IS NOT NULL
        GROUP BY alert_id
      )
      SELECT 
        CASE 
          WHEN decode_rate >= 90 THEN '90-100%'
          WHEN decode_rate >= 80 THEN '80-89%'
          WHEN decode_rate >= 70 THEN '70-79%'
          WHEN decode_rate >= 60 THEN '60-69%'
          WHEN decode_rate >= 50 THEN '50-59%'
          WHEN decode_rate >= 40 THEN '40-49%'
          WHEN decode_rate >= 30 THEN '30-39%'
          WHEN decode_rate >= 20 THEN '20-29%'
          WHEN decode_rate >= 10 THEN '10-19%'
          ELSE '0-9%'
        END as decode_range,
        COUNT(*) as alert_count,
        SUM(total_records) as total_records_in_range
      FROM alert_decode_rates
      GROUP BY decode_range
      ORDER BY decode_range DESC
    `);

    console.log('  - デコード率別アラート分布:');
    decodeRateDistribution[0].forEach((row, index) => {
      console.log(`    ${index + 1}. ${row.decode_range}: ${row.alert_count.toLocaleString()}アラート (${row.total_records_in_range.toLocaleString()}レコード)`);
    });

    // 4. サンプルアラートの詳細
    console.log('\n📝 ステップ4: サンプルアラートの詳細');
    const sampleAlerts = await bigquery.query(`
      SELECT 
        alert_id,
        COUNT(*) as total_records,
        COUNT(CASE WHEN decoded_subject NOT LIKE '%=?%' THEN 1 END) as decoded_subjects,
        COUNT(CASE WHEN decoded_sender NOT LIKE '%=?%' THEN 1 END) as decoded_senders,
        ROUND(COUNT(CASE WHEN decoded_subject NOT LIKE '%=?%' THEN 1 END) * 100.0 / COUNT(*), 1) as subject_decode_rate,
        ROUND(COUNT(CASE WHEN decoded_sender NOT LIKE '%=?%' THEN 1 END) * 100.0 / COUNT(*), 1) as sender_decode_rate,
        AVG(quality_score) as avg_quality
      FROM \`viewpers.salesguard_data.completely_decoded_emails\`
      WHERE alert_id IS NOT NULL
      GROUP BY alert_id
      HAVING COUNT(*) >= 10
      ORDER BY COUNT(CASE WHEN decoded_subject NOT LIKE '%=?%' THEN 1 END) DESC
      LIMIT 5
    `);

    console.log('  - デコード済み件数が多いアラート（上位5件）:');
    sampleAlerts[0].forEach((row, index) => {
      console.log(`    ${index + 1}. アラートID: ${row.alert_id}`);
      console.log(`       総レコード: ${row.total_records.toLocaleString()}件`);
      console.log(`       デコード済み件名: ${row.decoded_subjects.toLocaleString()}件 (${row.subject_decode_rate}%)`);
      console.log(`       デコード済み送信者: ${row.decoded_senders.toLocaleString()}件 (${row.sender_decode_rate}%)`);
      console.log(`       平均品質: ${row.avg_quality.toFixed(1)}点`);
      console.log('');
    });

    // 5. 要約
    console.log('\n🎯 ステップ5: 要約');
    console.log(`  - 総アラート数: ${alertStats.total_alerts.toLocaleString()}件`);
    console.log(`  - デコード対象を含むアラート: ${alertStats.alerts_with_any_decoded.toLocaleString()}件`);
    console.log(`  - デコード対象を含むアラートの割合: ${(alertStats.alerts_with_any_decoded/alertStats.total_alerts*100).toFixed(1)}%`);
    
    if (alertStats.alerts_with_any_decoded > 0) {
      console.log(`  - ✅ デコード対象を含むアラートが${alertStats.alerts_with_any_decoded.toLocaleString()}件存在`);
    } else {
      console.log(`  - ⚠️  デコード対象を含むアラートが存在しません`);
    }

    return {
      success: true,
      totalAlerts: alertStats.total_alerts,
      alertsWithDecodedData: alertStats.alerts_with_any_decoded,
      decodeRate: (alertStats.alerts_with_any_decoded/alertStats.total_alerts*100)
    };

  } catch (error) {
    console.error('❌ エラー:', error.message);
    return { success: false, error: error.message };
  }
}

// 実行
if (require.main === module) {
  checkAlertsWithDecodedData()
    .then(result => {
      if (result.success) {
        console.log('\n🎉 アラート分析完了！');
        console.log(`📊 総アラート数: ${result.totalAlerts.toLocaleString()}件`);
        console.log(`📊 デコード対象を含むアラート: ${result.alertsWithDecodedData.toLocaleString()}件`);
        console.log(`📊 デコード対象を含むアラートの割合: ${result.decodeRate.toFixed(1)}%`);
      } else {
        console.log('\n❌ 分析が失敗しました:', result.error);
      }
    })
    .catch(console.error);
}

module.exports = { checkAlertsWithDecodedData }; 
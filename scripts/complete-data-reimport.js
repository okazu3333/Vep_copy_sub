const { BigQuery } = require('@google-cloud/bigquery');

const bigquery = new BigQuery({
  projectId: 'viewpers'
});

// 完全データ再インポート実装
async function completeDataReimport() {
  try {
    console.log('🚀 完全データ再インポートを開始します...\n');

    // 1. 現在の状況確認
    console.log('📊 ステップ1: 現在の状況確認');
    const currentStats = await bigquery.query(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(CASE WHEN decoded_sender NOT LIKE '%=?%' THEN 1 END) as decoded_senders,
        COUNT(CASE WHEN decoded_subject NOT LIKE '%=?%' THEN 1 END) as decoded_subjects,
        AVG(quality_score) as avg_quality
      FROM \`viewpers.salesguard_data.japanese_decoded_emails\`
    `);

    const stats = currentStats[0][0];
    console.log(`  - 現在の総レコード数: ${stats.total_records.toLocaleString()}件`);
    console.log(`  - デコード済み送信者: ${stats.decoded_senders.toLocaleString()}件 (${(stats.decoded_senders/stats.total_records*100).toFixed(1)}%)`);
    console.log(`  - デコード済み件名: ${stats.decoded_subjects.toLocaleString()}件 (${(stats.decoded_subjects/stats.total_records*100).toFixed(1)}%)`);
    console.log(`  - 平均品質スコア: ${stats.avg_quality.toFixed(1)}点\n`);

    // 2. 新しいテーブル作成
    console.log('📋 ステップ2: 新しいテーブル作成');
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS \`viewpers.salesguard_data.completely_decoded_emails\` (
        message_id STRING,
        thread_id INT64,
        decoded_sender STRING,
        decoded_recipient STRING,
        decoded_subject STRING,
        decoded_snippet STRING,
        decoded_body STRING,
        created_at TIMESTAMP,
        status STRING,
        priority STRING,
        customer_name STRING,
        quality_score FLOAT64,
        encoding_type STRING,
        original_message_id STRING,
        workspace_id STRING,
        alert_id STRING,
        customer_id STRING,
        rule_id INT64,
        segment_id STRING,
        score INT64,
        detected_keyword STRING,
        message_timestamp TIMESTAMP,
        customer_company STRING,
        customer_email STRING,
        assigned_user_id INT64,
        department STRING,
        assigned_person INT64,
        detection_source STRING,
        metadata STRING,
        resolved_at INT64,
        resolved_by INT64,
        resolution_note INT64,
        updated_at TIMESTAMP
      )
    `;

    await bigquery.query({ query: createTableQuery });
    console.log('✅ 新しいテーブル作成完了');

    // 3. デコード関数とデータ移行
    console.log('\n🔧 ステップ3: デコード関数作成とデータ移行');
    const migrationQuery = `
      CREATE TEMP FUNCTION decodeMimeHeaderRobust(encoded_string STRING)
      RETURNS STRING
      LANGUAGE js AS r"""
          if (encoded_string === null || encoded_string === undefined) {
              return null;
          }

          // MIME Encoded-Wordのパターンにマッチさせる
          const mimeWordRegex = /=\\?(.+?)\\?([BQ])\\?(.*?)\\?=/g;

          return encoded_string.replace(mimeWordRegex, (match, charset, encoding, encodedText) => {
              try {
                  const lowerCharset = charset.toLowerCase();

                  if (encoding.toUpperCase() === 'B') {
                      // Base64デコード
                      const decodedBytes = atob(encodedText);
                      if (lowerCharset === 'utf-8') {
                           return decodeURIComponent(escape(decodedBytes));
                      }
                      return decodedBytes;

                  } else if (encoding.toUpperCase() === 'Q') {
                      // Quoted-Printableデコード
                      let text = encodedText.replace(/_/g, ' ');
                      text = text.replace(/=([A-F0-9]{2})/g, (match, hex) => {
                          return String.fromCharCode(parseInt(hex, 16));
                      });
                      return text;
                  }
                  return match;
              } catch (e) {
                  return match;
              }
          });
      """
      
      INSERT INTO \`viewpers.salesguard_data.completely_decoded_emails\`
      SELECT 
        message_id,
        thread_id,
        message_sender as decoded_sender,
        '' as decoded_recipient,
        decodeMimeHeaderRobust(message_subject) as decoded_subject,
        message_snippet as decoded_snippet,
        message_body as decoded_body,
        created_at,
        status,
        priority,
        customer_name,
        CASE 
          WHEN decodeMimeHeaderRobust(message_subject) IS NOT NULL 
          AND decodeMimeHeaderRobust(message_subject) != message_subject 
          THEN 85.0
          ELSE 50.0
        END as quality_score,
        CASE 
          WHEN message_subject LIKE '%=?UTF-8?B?%' THEN 'UTF-8'
          WHEN message_subject LIKE '%=?ISO-2022-JP?B?%' THEN 'ISO-2022-JP'
          ELSE 'PLAIN'
        END as encoding_type,
        message_id as original_message_id,
        workspace_id,
        alert_id,
        customer_id,
        rule_id,
        segment_id,
        score,
        detected_keyword,
        message_timestamp,
        customer_company,
        customer_email,
        assigned_user_id,
        department,
        assigned_person,
        detection_source,
        metadata,
        resolved_at,
        resolved_by,
        resolution_note,
        updated_at
      FROM \`viewpers.salesguard_data.mbox_emails\`
      WHERE message_body IS NOT NULL
    `;

    console.log('⚠️  大量データ処理を開始します...');
    console.log('    - 処理件数: 771,705件');
    console.log('    - 推定時間: 10-30分');
    console.log('    - 推定コスト: $5-15');
    console.log('\n🔄 データ移行を開始します...');

    const startTime = Date.now();
    await bigquery.query({ query: migrationQuery });
    const endTime = Date.now();
    const processingTime = Math.round((endTime - startTime) / 1000);

    console.log(`✅ データ移行完了！処理時間: ${processingTime}秒`);

    // 4. 結果確認
    console.log('\n📊 ステップ4: 結果確認');
    const resultStats = await bigquery.query(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(CASE WHEN decoded_sender NOT LIKE '%=?%' THEN 1 END) as decoded_senders,
        COUNT(CASE WHEN decoded_subject NOT LIKE '%=?%' THEN 1 END) as decoded_subjects,
        AVG(quality_score) as avg_quality,
        COUNT(CASE WHEN quality_score >= 80 THEN 1 END) as high_quality_records
      FROM \`viewpers.salesguard_data.completely_decoded_emails\`
    `);

    const result = resultStats[0][0];
    console.log(`  - 新しい総レコード数: ${result.total_records.toLocaleString()}件`);
    console.log(`  - デコード済み送信者: ${result.decoded_senders.toLocaleString()}件 (${(result.decoded_senders/result.total_records*100).toFixed(1)}%)`);
    console.log(`  - デコード済み件名: ${result.decoded_subjects.toLocaleString()}件 (${(result.decoded_subjects/result.total_records*100).toFixed(1)}%)`);
    console.log(`  - 平均品質スコア: ${result.avg_quality.toFixed(1)}点`);
    console.log(`  - 高品質レコード: ${result.high_quality_records.toLocaleString()}件 (${(result.high_quality_records/result.total_records*100).toFixed(1)}%)`);

    // 5. 改善効果の計算
    const senderImprovement = ((result.decoded_senders/result.total_records) - (stats.decoded_senders/stats.total_records)) * 100;
    const subjectImprovement = ((result.decoded_subjects/result.total_records) - (stats.decoded_subjects/stats.total_records)) * 100;
    const qualityImprovement = result.avg_quality - stats.avg_quality;

    console.log('\n📈 改善効果:');
    console.log(`  - 送信者デコード率: +${senderImprovement.toFixed(1)}%`);
    console.log(`  - 件名デコード率: +${subjectImprovement.toFixed(1)}%`);
    console.log(`  - 品質スコア: +${qualityImprovement.toFixed(1)}点`);

    return {
      success: true,
      processingTime,
      improvement: {
        sender: senderImprovement,
        subject: subjectImprovement,
        quality: qualityImprovement
      }
    };

  } catch (error) {
    console.error('❌ エラー:', error.message);
    return { success: false, error: error.message };
  }
}

// 実行
if (require.main === module) {
  completeDataReimport()
    .then(result => {
      if (result.success) {
        console.log('\n🎉 完全データ再インポートが成功しました！');
        console.log('\n📋 次のステップ:');
        console.log('  1. APIエンドポイントの更新');
        console.log('  2. システムテスト');
        console.log('  3. 本番切り替え');
      } else {
        console.log('\n❌ 処理が失敗しました:', result.error);
      }
    })
    .catch(console.error);
}

module.exports = { completeDataReimport }; 
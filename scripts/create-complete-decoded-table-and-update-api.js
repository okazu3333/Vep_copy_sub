const { BigQuery } = require('@google-cloud/bigquery');
const fs = require('fs');
const path = require('path');

const bigquery = new BigQuery({
  projectId: 'viewpers'
});

// 完全デコードテーブル作成とAPI更新
async function createCompleteDecodedTableAndUpdateAPI() {
  try {
    console.log('🚀 完全デコードデータの挿入とAPI更新を開始します...\n');

    // 1. デコード関数付きデータ移行
    console.log('🔧 ステップ1: デコード関数付きデータ移行');
    const migrationQuery = `
CREATE TEMP FUNCTION decodeMimeHeaderRobust(encoded_string STRING)
RETURNS STRING
LANGUAGE js AS r"""
    if (encoded_string === null || encoded_string === undefined) {
        return null;
    }
    const mimeWordRegex = /=\?(.+?)\?([BQ])\?(.*?)\?=/g;
    return encoded_string.replace(mimeWordRegex, (match, charset, encoding, encodedText) => {
        try {
            if (encoding.toUpperCase() === 'B') {
                const decodedBytes = atob(encodedText);
                if (charset.toLowerCase() === 'utf-8') {
                     return decodeURIComponent(escape(decodedBytes));
                }
                return decodedBytes;
            } else if (encoding.toUpperCase() === 'Q') {
                let text = encodedText.replace(/_/g, ' ');
                text = text.replace(/=([A-F0-9]{2})/g, (m, hex) => String.fromCharCode(parseInt(hex, 16)));
                return text;
            }
            return match;
        } catch (e) {
            return match;
        }
    });
""";

INSERT INTO \`viewpers.salesguard_data.completely_decoded_emails\` (
    message_id,
    thread_id,
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
    encoding_type,
    original_message_id,
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
)
SELECT
    message_id,
    thread_id,
    message_sender,
    '',
    decodeMimeHeaderRobust(message_subject),
    message_snippet,
    message_body,
    created_at,
    status,
    priority,
    customer_name,
    CASE 
      WHEN decodeMimeHeaderRobust(message_subject) IS NOT NULL 
      AND decodeMimeHeaderRobust(message_subject) != message_subject 
      THEN 85.0
      ELSE 50.0
    END,
    CASE 
      WHEN message_subject LIKE '%=?UTF-8?B?%' THEN 'UTF-8'
      WHEN message_subject LIKE '%=?ISO-2022-JP?B?%' THEN 'ISO-2022-JP'
      ELSE 'PLAIN'
    END,
    message_id,
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
FROM
  \`viewpers.salesguard_data.mbox_emails\`
WHERE message_body IS NOT NULL;
`;

    console.log('⚠️  大量データ処理を開始します...');
    console.log('    - 推定時間: 10-30分');
    console.log('    - 推定コスト: $5-15');
    console.log('\n🔄 データ移行を開始します...');

    const startTime = Date.now();
    await bigquery.query({ query: migrationQuery });
    const endTime = Date.now();
    const processingTime = Math.round((endTime - startTime) / 1000);

    console.log(`✅ データ移行完了！処理時間: ${processingTime}秒`);

    // 2. API更新
    console.log('\n🔧 ステップ2: API更新');
    const apiRoutePath = 'app/api/alerts/route.ts';
    let apiContent = fs.readFileSync(apiRoutePath, 'utf8');
    apiContent = apiContent.replace(
      /FROM `viewpers\.salesguard_data\.safe_decoded_emails`/g,
      'FROM `viewpers.salesguard_data.completely_decoded_emails`'
    );
    fs.writeFileSync(apiRoutePath, apiContent);
    console.log('✅ API更新完了');

    // 3. 結果確認
    console.log('\n📊 ステップ3: 結果確認');
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

    // 4. 古いテーブルの削除（オプション）
    console.log('\n🗑️  ステップ4: 古いテーブルの削除（オプション）');
    console.log('    - japanese_decoded_emails: 品質が低いため削除可能');
    console.log('    - safe_decoded_emails: API更新後は削除可能');
    console.log('    - 削除する場合は手動で実行してください');

    return {
      success: true,
      processingTime,
      newTableName: 'completely_decoded_emails',
      totalRecords: result.total_records,
      avgQuality: result.avg_quality
    };

  } catch (error) {
    console.error('❌ エラー:', error.message);
    return { success: false, error: error.message };
  }
}

// 実行
if (require.main === module) {
  createCompleteDecodedTableAndUpdateAPI()
    .then(result => {
      if (result.success) {
        console.log('\n🎉 完全デコードテーブル作成とAPI更新が成功しました！');
        console.log(`📊 処理時間: ${result.processingTime}秒`);
        console.log(`📊 総レコード数: ${result.totalRecords.toLocaleString()}件`);
        console.log(`📊 平均品質スコア: ${result.avgQuality.toFixed(1)}点`);
        console.log('\n📋 次のステップ:');
        console.log('  1. システムテストの実行');
        console.log('  2. 古いテーブルの削除（オプション）');
        console.log('  3. パフォーマンス監視');
      } else {
        console.log('\n❌ 処理が失敗しました:', result.error);
      }
    })
    .catch(console.error);
}

module.exports = { createCompleteDecodedTableAndUpdateAPI }; 
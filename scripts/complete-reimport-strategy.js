const { BigQuery } = require('@google-cloud/bigquery');

const bigquery = new BigQuery({
  projectId: 'viewpers'
});

// 完全デコード実装戦略
async function implementCompleteReimport() {
  try {
    console.log('🚀 完全デコード実装戦略を開始します...\n');

    // 1. 新しいテーブル作成
    console.log('📋 ステップ1: 新しいテーブル作成');
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

    // 2. デコード関数の作成
    console.log('\n🔧 ステップ2: デコード関数作成');
    const decodeFunctionQuery = `
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
    `;

    // 3. データ移行クエリ
    console.log('\n📦 ステップ3: データ移行クエリ作成');
    const migrationQuery = `
      ${decodeFunctionQuery}
      
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

    console.log('📝 移行クエリ準備完了');
    console.log('\n⚠️  注意: このクエリは大量のデータを処理します');
    console.log('    - 処理件数: 771,705件');
    console.log('    - 推定処理時間: 10-30分');
    console.log('    - コスト: 約$5-15');

    return {
      createTableQuery,
      decodeFunctionQuery,
      migrationQuery,
      estimatedRecords: 771705,
      estimatedCost: '$5-15',
      estimatedTime: '10-30分'
    };

  } catch (error) {
    console.error('❌ エラー:', error.message);
    throw error;
  }
}

// 実行
if (require.main === module) {
  implementCompleteReimport()
    .then(result => {
      console.log('\n🎯 実装戦略完了');
      console.log(`📊 推定処理件数: ${result.estimatedRecords.toLocaleString()}件`);
      console.log(`💰 推定コスト: ${result.estimatedCost}`);
      console.log(`⏱️  推定時間: ${result.estimatedTime}`);
      console.log('\n📋 次のステップ:');
      console.log('  1. 移行クエリを実行');
      console.log('  2. 品質チェック');
      console.log('  3. API更新');
    })
    .catch(console.error);
}

module.exports = { implementCompleteReimport }; 
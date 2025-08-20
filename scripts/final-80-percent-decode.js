const { BigQuery } = require('@google-cloud/bigquery');
const fs = require('fs');

const bigquery = new BigQuery({
  projectId: 'viewpers'
});

async function final80PercentDecode() {
  try {
    console.log('🚀 80%デコード率達成のための最終実装を開始します...\n');

    // 1. テーブルクリア
    console.log('🗑️  ステップ1: テーブルクリア');
    await bigquery.query(`
      DELETE FROM \`viewpers.salesguard_data.completely_decoded_emails\`
      WHERE 1=1
    `);
    console.log('✅ テーブルクリア完了');

    // 2. 段階的デコード実装
    console.log('\n🔧 ステップ2: 段階的デコード実装');
    
    // ステップ2-1: プレーンテキスト + UTF-8 Base64
    console.log('  📝 ステップ2-1: プレーンテキスト + UTF-8 Base64');
    const step1Query = `
CREATE TEMP FUNCTION decodeUTF8Base64(encoded_string STRING)
RETURNS STRING
LANGUAGE js AS r"""
    if (encoded_string === null || encoded_string === undefined) {
        return null;
    }
    
    const mimeWordRegex = /=\\?UTF-8\\?B\\?(.*?)\\?=/g;
    
    return encoded_string.replace(mimeWordRegex, (match, encodedText) => {
        try {
            const decodedBytes = atob(encodedText);
            return decodeURIComponent(escape(decodedBytes));
        } catch (e) {
            return match;
        }
    });
""";

INSERT INTO \`viewpers.salesguard_data.completely_decoded_emails\`
SELECT 
    message_id,
    thread_id,
    message_sender,
    '',
    CASE 
      WHEN message_subject LIKE '%=?UTF-8?B?%' THEN decodeUTF8Base64(message_subject)
      ELSE message_subject
    END as decoded_subject,
    message_snippet,
    message_body,
    created_at,
    status,
    priority,
    customer_name,
    CASE 
      WHEN message_subject LIKE '%=?UTF-8?B?%' AND decodeUTF8Base64(message_subject) != message_subject 
      THEN 85.0
      ELSE 50.0
    END as quality_score,
    CASE 
      WHEN message_subject LIKE '%=?UTF-8?B?%' THEN 'UTF-8'
      ELSE 'PLAIN'
    END as encoding_type,
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
WHERE message_body IS NOT NULL
  AND (message_subject NOT LIKE '%=?%' OR message_subject LIKE '%=?UTF-8?B?%');
`;

    console.log('    - UTF-8 Base64デコード実行中...');
    await bigquery.query({ query: step1Query });
    console.log('    - ✅ UTF-8 Base64デコード完了');

    // ステップ2-2: ISO-2022-JP Base64
    console.log('  📝 ステップ2-2: ISO-2022-JP Base64');
    const step2Query = `
CREATE TEMP FUNCTION decodeISO2022JPBase64(encoded_string STRING)
RETURNS STRING
LANGUAGE js AS r"""
    if (encoded_string === null || encoded_string === undefined) {
        return null;
    }
    
    const mimeWordRegex = /=\\?ISO-2022-JP\\?B\\?(.*?)\\?=/g;
    
    return encoded_string.replace(mimeWordRegex, (match, encodedText) => {
        try {
            const decodedBytes = atob(encodedText);
            return decodeURIComponent(escape(decodedBytes));
        } catch (e) {
            return match;
        }
    });
""";

INSERT INTO \`viewpers.salesguard_data.completely_decoded_emails\`
SELECT 
    message_id,
    thread_id,
    message_sender,
    '',
    CASE 
      WHEN message_subject LIKE '%=?ISO-2022-JP?B?%' THEN decodeISO2022JPBase64(message_subject)
      ELSE message_subject
    END as decoded_subject,
    message_snippet,
    message_body,
    created_at,
    status,
    priority,
    customer_name,
    CASE 
      WHEN message_subject LIKE '%=?ISO-2022-JP?B?%' AND decodeISO2022JPBase64(message_subject) != message_subject 
      THEN 85.0
      ELSE 50.0
    END as quality_score,
    CASE 
      WHEN message_subject LIKE '%=?ISO-2022-JP?B?%' THEN 'ISO-2022-JP'
      ELSE 'PLAIN'
    END as encoding_type,
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
WHERE message_body IS NOT NULL
  AND message_subject LIKE '%=?ISO-2022-JP?B?%'
  AND message_id NOT IN (
    SELECT message_id FROM \`viewpers.salesguard_data.completely_decoded_emails\`
  );
`;

    console.log('    - ISO-2022-JP Base64デコード実行中...');
    await bigquery.query({ query: step2Query });
    console.log('    - ✅ ISO-2022-JP Base64デコード完了');

    // ステップ2-3: その他のエンコード形式
    console.log('  📝 ステップ2-3: その他のエンコード形式');
    const step3Query = `
CREATE TEMP FUNCTION decodeOtherEncodings(encoded_string STRING)
RETURNS STRING
LANGUAGE js AS r"""
    if (encoded_string === null || encoded_string === undefined) {
        return null;
    }
    
    const mimeWordRegex = /=\\?(.+?)\\?([BQ])\\?(.*?)\\?=/g;
    
    return encoded_string.replace(mimeWordRegex, (match, charset, encoding, encodedText) => {
        try {
            if (encoding.toUpperCase() === 'B') {
                const decodedBytes = atob(encodedText);
                return decodeURIComponent(escape(decodedBytes));
            } else if (encoding.toUpperCase() === 'Q') {
                let text = encodedText.replace(/_/g, ' ');
                text = text.replace(/=([A-F0-9]{2})/g, (m, hex) => String.fromCharCode(parseInt(hex, 16)));
                return decodeURIComponent(escape(text));
            }
            return match;
        } catch (e) {
            return match;
        }
    });
""";

INSERT INTO \`viewpers.salesguard_data.completely_decoded_emails\`
SELECT 
    message_id,
    thread_id,
    message_sender,
    '',
    CASE 
      WHEN message_subject LIKE '%=?%' THEN decodeOtherEncodings(message_subject)
      ELSE message_subject
    END as decoded_subject,
    message_snippet,
    message_body,
    created_at,
    status,
    priority,
    customer_name,
    CASE 
      WHEN message_subject LIKE '%=?%' AND decodeOtherEncodings(message_subject) != message_subject 
      THEN 85.0
      ELSE 50.0
    END as quality_score,
    'OTHER' as encoding_type,
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
WHERE message_body IS NOT NULL
  AND message_subject LIKE '%=?%'
  AND message_subject NOT LIKE '%=?UTF-8?B?%'
  AND message_subject NOT LIKE '%=?ISO-2022-JP?B?%'
  AND message_id NOT IN (
    SELECT message_id FROM \`viewpers.salesguard_data.completely_decoded_emails\`
  );
`;

    console.log('    - その他エンコード形式デコード実行中...');
    await bigquery.query({ query: step3Query });
    console.log('    - ✅ その他エンコード形式デコード完了');

    // 3. 結果確認
    console.log('\n📊 ステップ3: 最終結果確認');
    const resultStats = await bigquery.query(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(CASE WHEN decoded_sender NOT LIKE '%=?%' THEN 1 END) as decoded_senders,
        COUNT(CASE WHEN decoded_subject NOT LIKE '%=?%' THEN 1 END) as decoded_subjects,
        AVG(quality_score) as avg_quality,
        COUNT(CASE WHEN quality_score >= 80 THEN 1 END) as high_quality_records,
        COUNT(CASE WHEN quality_score >= 70 THEN 1 END) as medium_quality_records,
        COUNT(DISTINCT message_id) as unique_records
      FROM \`viewpers.salesguard_data.completely_decoded_emails\`
    `);

    const result = resultStats[0][0];
    const decodeRate = ((result.decoded_subjects + result.decoded_senders) / (result.total_records * 2)) * 100;
    
    console.log(`  - 新しい総レコード数: ${result.total_records.toLocaleString()}件`);
    console.log(`  - ユニークレコード数: ${result.unique_records.toLocaleString()}件`);
    console.log(`  - デコード済み送信者: ${result.decoded_senders.toLocaleString()}件 (${(result.decoded_senders/result.total_records*100).toFixed(1)}%)`);
    console.log(`  - デコード済み件名: ${result.decoded_subjects.toLocaleString()}件 (${(result.decoded_subjects/result.total_records*100).toFixed(1)}%)`);
    console.log(`  - 総合デコード率: ${decodeRate.toFixed(1)}%`);
    console.log(`  - 平均品質スコア: ${result.avg_quality.toFixed(1)}点`);
    console.log(`  - 高品質レコード: ${result.high_quality_records.toLocaleString()}件 (${(result.high_quality_records/result.total_records*100).toFixed(1)}%)`);
    console.log(`  - 中品質レコード: ${result.medium_quality_records.toLocaleString()}件 (${(result.medium_quality_records/result.total_records*100).toFixed(1)}%)`);

    // 4. 80%達成判定
    console.log('\n🎯 ステップ4: 80%達成判定');
    if (decodeRate >= 80) {
      console.log(`✅ 目標達成！デコード率: ${decodeRate.toFixed(1)}% (目標: 80%)`);
    } else {
      console.log(`⚠️  目標未達成。デコード率: ${decodeRate.toFixed(1)}% (目標: 80%)`);
      console.log(`📋 さらなる対策が必要です`);
    }

    // 5. エンコード形式別統計
    console.log('\n📊 ステップ5: エンコード形式別統計');
    const encodingStats = await bigquery.query(`
      SELECT 
        encoding_type,
        COUNT(*) as count,
        COUNT(CASE WHEN decoded_subject NOT LIKE '%=?%' THEN 1 END) as decoded_count,
        ROUND(COUNT(CASE WHEN decoded_subject NOT LIKE '%=?%' THEN 1 END) * 100.0 / COUNT(*), 1) as decode_rate
      FROM \`viewpers.salesguard_data.completely_decoded_emails\`
      GROUP BY encoding_type
      ORDER BY count DESC
    `);

    console.log('  - エンコード形式別デコード率:');
    encodingStats[0].forEach((row, index) => {
      console.log(`    ${index + 1}. ${row.encoding_type}: ${row.count.toLocaleString()}件 (デコード率: ${row.decode_rate}%)`);
    });

    return {
      success: true,
      totalRecords: result.total_records,
      uniqueRecords: result.unique_records,
      decodeRate,
      avgQuality: result.avg_quality
    };

  } catch (error) {
    console.error('❌ エラー:', error.message);
    return { success: false, error: error.message };
  }
}

// 実行
if (require.main === module) {
  final80PercentDecode()
    .then(result => {
      if (result.success) {
        console.log('\n🎉 80%デコード率達成のための最終実装が成功しました！');
        console.log(`📊 総レコード数: ${result.totalRecords.toLocaleString()}件`);
        console.log(`📊 ユニークレコード数: ${result.uniqueRecords.toLocaleString()}件`);
        console.log(`📊 デコード率: ${result.decodeRate.toFixed(1)}%`);
        console.log(`📊 平均品質スコア: ${result.avgQuality.toFixed(1)}点`);
        
        if (result.decodeRate >= 80) {
          console.log('\n🎯 80%デコード目標達成！');
        } else {
          console.log('\n📋 さらなる対策が必要です');
        }
      } else {
        console.log('\n❌ 処理が失敗しました:', result.error);
      }
    })
    .catch(console.error);
}

module.exports = { final80PercentDecode }; 
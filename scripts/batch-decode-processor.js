const { BigQuery } = require('@google-cloud/bigquery');

const bigquery = new BigQuery({
  projectId: 'viewpers'
});

// バッチ処理設定
const BATCH_SIZE = 1000; // 1回の処理件数
const MAX_BATCHES = 10; // 最大バッチ数（テスト用）

async function processBatchDecode() {
  try {
    console.log('🚀 バッチデコード処理を開始します...');
    console.log(`📊 設定: バッチサイズ=${BATCH_SIZE}, 最大バッチ数=${MAX_BATCHES}`);

    let totalProcessed = 0;
    let totalSuccess = 0;
    let totalErrors = 0;

    for (let batchNum = 1; batchNum <= MAX_BATCHES; batchNum++) {
      console.log(`\n📦 バッチ ${batchNum}/${MAX_BATCHES} を処理中...`);

      // 現在のバッチで処理するデータを取得
      const offset = (batchNum - 1) * BATCH_SIZE;
      
      const query = `
        CREATE TEMP FUNCTION decodeMimeHeaderRobust(encoded_string STRING)
        RETURNS STRING
        LANGUAGE js AS r"""
            if (encoded_string === null || encoded_string === undefined) {
                return null;
            }

            const mimeWordRegex = /=\?(.+?)\?([BQ])\?(.*?)\?=/g;

            return encoded_string.replace(mimeWordRegex, (match, charset, encoding, encodedText) => {
                try {
                    const lowerCharset = charset.toLowerCase();

                    if (encoding.toUpperCase() === 'B') {
                        const decodedBytes = atob(encodedText);
                        if (lowerCharset === 'utf-8') {
                             return decodeURIComponent(escape(decodedBytes));
                        }
                        return decodedBytes;

                    } else if (encoding.toUpperCase() === 'Q') {
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
        """;

        CREATE TEMP FUNCTION parseMessageObject(text STRING)
        RETURNS STRING
        LANGUAGE js AS r"""
            if (!text || typeof text !== 'string') {
                return '';
            }

            if (text.includes('<email.message.Message object')) {
                try {
                    return text.replace(/<email\.message\.Message object at [^>]+>/g, '')
                               .replace(/\[|\]/g, '')
                               .trim();
                } catch (e) {
                    return text;
                }
            }

            return text;
        """;

        INSERT INTO \`viewpers.salesguard_data.completely_decoded_emails\`
        SELECT
          message_id,
          thread_id,
          decodeMimeHeaderRobust(decoded_sender) AS decoded_sender,
          decodeMimeHeaderRobust(decoded_recipient) AS decoded_recipient,
          decodeMimeHeaderRobust(decoded_subject) AS decoded_subject,
          decoded_snippet,
          parseMessageObject(decodeMimeHeaderRobust(decoded_body)) AS decoded_body,
          created_at,
          status,
          priority,
          decodeMimeHeaderRobust(customer_name) AS customer_name,
          customer_company,
          quality_score,
          encoding_type
        FROM
          \`viewpers.salesguard_data.japanese_decoded_emails\`
        WHERE
          quality_score < 80
          AND (decoded_sender LIKE '=?%' OR decoded_subject LIKE '=?%' OR decoded_body LIKE '%<email.message.Message object%')
          AND message_id NOT IN (
            SELECT message_id FROM \`viewpers.salesguard_data.completely_decoded_emails\`
          )
        ORDER BY
          created_at DESC
        LIMIT ${BATCH_SIZE}
        OFFSET ${offset}
      `;

      try {
        const [result] = await bigquery.query({ query });
        const processedCount = result.length || 0;
        
        totalProcessed += processedCount;
        totalSuccess += processedCount;
        
        console.log(`✅ バッチ ${batchNum} 完了: ${processedCount}件処理`);
        
        // 処理対象がなくなったら終了
        if (processedCount === 0) {
          console.log('📭 処理対象がなくなりました');
          break;
        }
        
      } catch (error) {
        console.error(`❌ バッチ ${batchNum} エラー:`, error);
        totalErrors++;
      }

      // バッチ間の待機時間（BigQueryの制限を考慮）
      if (batchNum < MAX_BATCHES) {
        console.log('⏳ 次のバッチまで待機中...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // 結果統計
    console.log('\n📊 バッチ処理完了統計:');
    console.log(`  総処理件数: ${totalProcessed}件`);
    console.log(`  成功: ${totalSuccess}件`);
    console.log(`  エラー: ${totalErrors}件`);
    console.log(`  成功率: ${((totalSuccess / totalProcessed) * 100).toFixed(1)}%`);

    // 最終統計の確認
    const statsQuery = `
      SELECT 
        COUNT(*) as total_records,
        COUNT(CASE WHEN decoded_sender NOT LIKE '=?%' THEN 1 END) as decoded_senders,
        COUNT(CASE WHEN decoded_subject NOT LIKE '=?%' THEN 1 END) as decoded_subjects,
        COUNT(CASE WHEN decoded_body NOT LIKE '%<email.message.Message object%' THEN 1 END) as decoded_bodies,
        AVG(quality_score) as avg_quality_score
      FROM \`viewpers.salesguard_data.completely_decoded_emails\`
    `;

    const [statsResult] = await bigquery.query({ query: statsQuery });
    const stats = statsResult[0];

    console.log('\n📈 デコード済みテーブル統計:');
    console.log(`  総レコード数: ${stats.total_records.toLocaleString()}件`);
    console.log(`  デコード済み送信者: ${stats.decoded_senders.toLocaleString()}件`);
    console.log(`  デコード済み件名: ${stats.decoded_subjects.toLocaleString()}件`);
    console.log(`  デコード済み本文: ${stats.decoded_bodies.toLocaleString()}件`);
    console.log(`  平均品質スコア: ${stats.avg_quality_score.toFixed(2)}点`);

    console.log('\n✅ バッチデコード処理が完了しました');

  } catch (error) {
    console.error('❌ バッチ処理エラー:', error);
  }
}

processBatchDecode(); 
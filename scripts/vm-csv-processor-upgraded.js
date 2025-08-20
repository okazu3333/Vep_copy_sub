const { Storage } = require('@google-cloud/storage');
const { BigQuery } = require('@google-cloud/bigquery');
const iconv = require('iconv-lite');
const fs = require('fs');
const csv = require('csv-parser');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

const storage = new Storage();
const bigquery = new BigQuery();

const PROJECT_ID = 'viewpers';
const DATASET_ID = 'salesguard_alerts_new';
const TABLE_ID = 'alerts_csv_processed_upgraded';

/**
 * CSVファイル処理（並列対応）
 */
async function processCsvFile(csvFileName) {
  try {
    console.log(`🚀 CSV処理開始: ${csvFileName}`);
    
    const emails = [];
    let processed = 0;
    let decoded = 0;
    
    return new Promise((resolve, reject) => {
      fs.createReadStream(csvFileName)
        .pipe(csv())
        .on('data', (row) => {
          processed++;
          
          // デコード処理
          const decodedEmail = {
            messageId: generateMessageId(),
            date: parseTimestamp(row.date || row.timestamp),
            subject: decodeHeader(row.subject || ''),
            body: decodeBody(row.body || row.content || ''),
            from: decodeHeader(row.from || ''),
            to: decodeHeader(row.to || ''),
            keywords: [],
            sourceFile: csvFileName,
            isDecoded: false
          };
          
          // デコード成功判定
          decodedEmail.isDecoded = decodedEmail.subject && 
            decodedEmail.subject !== row.subject && 
            !decodedEmail.subject.includes('<email.message.Message');
          
          if (decodedEmail.isDecoded) {
            decoded++;
          }
          
          // キーワード抽出
          decodedEmail.keywords = extractKeywords(decodedEmail.body, decodedEmail.subject);
          
          emails.push(decodedEmail);
          
          if (processed % 1000 === 0) {
            console.log(`📊 処理中: ${processed}件, デコード成功: ${decoded}件`);
          }
        })
        .on('end', async () => {
          console.log(`✅ CSV処理完了: ${processed}件処理, ${decoded}件デコード成功`);
          
          // BigQueryに挿入
          if (emails.length > 0) {
            await insertToBigQuery(emails);
          }
          
          resolve({
            success: true,
            totalProcessed: processed,
            totalDecoded: decoded,
            decodeRate: (decoded / processed * 100).toFixed(2)
          });
        })
        .on('error', (error) => {
          console.error('❌ CSV処理エラー:', error);
          reject(error);
        });
    });
    
  } catch (error) {
    console.error('❌ 処理エラー:', error);
    throw error;
  }
}

/**
 * ヘッダーデコード
 */
function decodeHeader(header) {
  if (!header) return '';
  
  try {
    return header.replace(/=\?([^?]+)\?([BQ])\?([^?]*)\?=/gi, (match, charset, encoding, encoded) => {
      try {
        let decoded;
        if (encoding.toUpperCase() === 'B') {
          decoded = Buffer.from(encoded, 'base64');
        } else if (encoding.toUpperCase() === 'Q') {
          decoded = Buffer.from(encoded.replace(/_/g, ' ').replace(/=([0-9A-F]{2})/gi, (m, hex) => 
            String.fromCharCode(parseInt(hex, 16))
          ), 'binary');
        } else {
          return match;
        }
        
        // 文字セット変換
        const charsetLower = charset.toLowerCase();
        if (charsetLower.includes('iso-2022-jp')) {
          return iconv.decode(decoded, 'iso-2022-jp');
        } else if (charsetLower.includes('utf-8')) {
          return decoded.toString('utf8');
        } else if (charsetLower.includes('shift_jis') || charsetLower.includes('sjis')) {
          return iconv.decode(decoded, 'shift_jis');
        } else {
          return decoded.toString('utf8');
        }
      } catch (e) {
        return match;
      }
    });
  } catch (error) {
    return header;
  }
}

/**
 * 本文デコード
 */
function decodeBody(body) {
  if (!body) return '';
  
  try {
    // HTMLタグ削除
    let decoded = body.replace(/<[^>]*>/g, '');
    
    // MIMEデコード
    decoded = decodeHeader(decoded);
    
    // 改行正規化
    decoded = decoded.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    return decoded;
  } catch (error) {
    return body;
  }
}

/**
 * キーワード抽出
 */
function extractKeywords(body, subject) {
  const keywords = [];
  const text = (subject + ' ' + body).toLowerCase();
  
  const importantKeywords = [
    '解約', 'キャンセル', '停止', '終了', 'クレーム', '苦情', '問題', 'エラー',
    '緊急', '至急', '急ぎ', '重要', '危険', '注意', '警告',
    '返金', '返済', '払い戻し', '補償', '賠償',
    '契約', '更新', '延長', '変更', '修正'
  ];
  
  for (const keyword of importantKeywords) {
    if (text.includes(keyword)) {
      keywords.push(keyword);
    }
  }
  
  return keywords;
}

/**
 * BigQueryに挿入
 */
async function insertToBigQuery(emails) {
  try {
    const dataset = bigquery.dataset(DATASET_ID);
    const table = dataset.table(TABLE_ID);
    
    // テーブル存在確認・作成
    const [exists] = await table.exists();
    if (!exists) {
      const schema = [
        { name: 'alert_id', type: 'STRING' },
        { name: 'message_id', type: 'STRING' },
        { name: 'message_timestamp', type: 'TIMESTAMP' },
        { name: 'message_sender', type: 'STRING' },
        { name: 'customer_email', type: 'STRING' },
        { name: 'message_subject', type: 'STRING' },
        { name: 'message_body', type: 'STRING' },
        { name: 'detected_keyword', type: 'STRING' },
        { name: 'priority', type: 'STRING' },
        { name: 'score', type: 'INTEGER' },
        { name: 'source_file', type: 'STRING' },
        { name: 'is_decoded', type: 'BOOLEAN' },
        { name: 'created_at', type: 'TIMESTAMP' }
      ];
      
      await table.create({ schema });
      console.log('✅ BigQueryテーブル作成完了');
    }
    
    const rows = emails.map(email => ({
      alert_id: `ALT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      message_id: email.messageId,
      message_timestamp: parseTimestamp(email.date),
      message_sender: email.from,
      customer_email: extractEmailAddress(email.from),
      message_subject: email.subject,
      message_body: email.body,
      detected_keyword: email.keywords.join(', '),
      priority: email.keywords.length > 0 ? 'High' : 'Medium',
      score: Math.min(email.keywords.length * 10, 100),
      source_file: email.sourceFile,
      is_decoded: email.isDecoded,
      created_at: new Date().toISOString()
    }));
    
    await table.insert(rows);
    console.log(`✅ BigQuery挿入完了: ${rows.length}件`);
    
  } catch (error) {
    console.error('❌ BigQuery挿入エラー:', error);
    throw error;
  }
}

/**
 * タイムスタンプ解析
 */
function parseTimestamp(dateStr) {
  try {
    return new Date(dateStr).toISOString();
  } catch (error) {
    return new Date().toISOString();
  }
}

/**
 * メールアドレス抽出
 */
function extractEmailAddress(from) {
  if (!from) return null;
  
  const emailMatch = from.match(/<([^>]+)>/);
  if (emailMatch) {
    return emailMatch[1];
  }
  
  const simpleEmailMatch = from.match(/[\w.-]+@[\w.-]+\.\w+/);
  if (simpleEmailMatch) {
    return simpleEmailMatch[0];
  }
  
  return from;
}

/**
 * メッセージID生成
 */
function generateMessageId() {
  return `MSG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// メイン実行
if (require.main === module) {
  const csvFileName = process.argv[2] || 'test.csv';
  
  processCsvFile(csvFileName)
    .then(result => {
      console.log('🎉 処理完了:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ 処理失敗:', error);
      process.exit(1);
    });
}

module.exports = { processCsvFile }; 
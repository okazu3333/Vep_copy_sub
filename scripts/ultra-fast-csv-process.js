const { Storage } = require('@google-cloud/storage');
const { BigQuery } = require('@google-cloud/bigquery');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const storage = new Storage();
const bigquery = new BigQuery();

const PROJECT_ID = 'viewpers';
const DATASET_ID = 'salesguard_alerts_new';
const TABLE_ID = 'alerts_ultra_fast';

/**
 * 超高速CSV処理
 */
async function ultraFastCSVProcess() {
  try {
    console.log('🚀 超高速CSV処理開始');
    
    // 1. 利用可能なCSVファイルを取得
    const bucket = storage.bucket('salesguarddata');
    const [files] = await bucket.getFiles({ prefix: 'mbox-processed/csv_chunks/' });
    
    const csvFiles = files.filter(file => file.name.endsWith('.csv'));
    console.log(`📦 処理対象CSVファイル: ${csvFiles.length}個`);
    
    // 2. 処理対象を選択（コマンドライン引数から）
    const targetFiles = process.argv.includes('--all') 
      ? csvFiles 
      : csvFiles.slice(0, parseInt(process.argv.find(arg => arg.startsWith('--files='))?.split('=')[1] || 10));
    
    console.log(`🎯 処理対象: ${targetFiles.length}個のファイル`);
    
    let totalProcessed = 0;
    let totalFixed = 0;
    
    // 3. 並列処理で高速実行
    const batchSize = 5; // 同時処理数
    for (let i = 0; i < targetFiles.length; i += batchSize) {
      const batch = targetFiles.slice(i, i + batchSize);
      console.log(`\n📦 バッチ処理 (${Math.floor(i/batchSize) + 1}/${Math.ceil(targetFiles.length/batchSize)}): ${batch.length}ファイル`);
      
      const promises = batch.map(csvFile => processCSVFile(csvFile));
      const results = await Promise.all(promises);
      
      for (const result of results) {
        totalProcessed += result.processed;
        totalFixed += result.fixed;
      }
      
      console.log(`✅ バッチ完了: ${results.reduce((sum, r) => sum + r.processed, 0)}件処理`);
    }
    
    console.log(`\n🎉 処理完了: 総計${totalProcessed}件処理, ${totalFixed}件修正`);
    
    return {
      success: true,
      totalProcessed,
      totalFixed
    };
    
  } catch (error) {
    console.error('❌ 処理エラー:', error);
    throw error;
  }
}

/**
 * CSVファイルを処理
 */
async function processCSVFile(csvFile) {
  try {
    console.log(`📄 処理中: ${path.basename(csvFile.name)}`);
    
    // 1. CSVファイルをダウンロード
    const tempDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'ultra-fast-csv-'));
    const csvPath = path.join(tempDir, 'data.csv');
    
    await csvFile.download({ destination: csvPath });
    
    // 2. CSVを高速解析
    const emails = await parseCSVFast(csvPath);
    
    // 3. 正常なメールのみを抽出
    const validEmails = emails.filter(email => 
      email && 
      email.from && 
      email.subject && 
      !email.from.includes('<email.message.Message') &&
      !email.subject.includes('<email.message.Message')
    );
    
    // 4. BigQueryにバッチ挿入
    if (validEmails.length > 0) {
      await insertToBigQueryBatch(validEmails);
    }
    
    // 5. 一時ファイルをクリーンアップ
    fs.rmSync(tempDir, { recursive: true, force: true });
    
    return {
      processed: emails.length,
      fixed: validEmails.length
    };
    
  } catch (error) {
    console.error(`❌ CSV処理エラー (${csvFile.name}):`, error);
    return { processed: 0, fixed: 0 };
  }
}

/**
 * CSVを高速解析
 */
async function parseCSVFast(csvPath) {
  return new Promise((resolve, reject) => {
    const emails = [];
    
    fs.createReadStream(csvPath)
      .pipe(csv())
      .on('data', (row) => {
        // CSVの行をメールオブジェクトに変換
        const email = {
          messageId: row.message_id || row.Message_ID,
          date: row.date || row.Date,
          from: decodeHeaderFast(row.from || row.From),
          to: decodeHeaderFast(row.to || row.To),
          subject: decodeHeaderFast(row.subject || row.Subject),
          body: decodeBodyFast(row.body || row.Body || row.content || row.Content),
          keywords: [],
          sourceFile: path.basename(csvPath)
        };
        
        // キーワード検出
        if (email.subject || email.body) {
          email.keywords = extractKeywordsFast(email.body || '', email.subject || '');
        }
        
        emails.push(email);
      })
      .on('end', () => {
        resolve(emails);
      })
      .on('error', reject);
  });
}

/**
 * 高速ヘッダーデコード
 */
function decodeHeaderFast(header) {
  if (!header) return null;
  
  try {
    // 簡易MIMEデコード（高速化）
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
        
        // 簡易文字セット変換
        const charsetLower = charset.toLowerCase();
        if (charsetLower.includes('iso-2022-jp')) {
          return require('iconv-lite').decode(decoded, 'iso-2022-jp');
        } else if (charsetLower.includes('utf-8')) {
          return decoded.toString('utf8');
        } else if (charsetLower.includes('shift_jis') || charsetLower.includes('sjis')) {
          return require('iconv-lite').decode(decoded, 'shift_jis');
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
 * 高速本文デコード
 */
function decodeBodyFast(body) {
  if (!body) return '';
  
  try {
    // 簡易HTMLタグ削除
    let decoded = body.replace(/<[^>]*>/g, '');
    
    // 簡易エンコードデコード
    decoded = decodeHeaderFast(decoded);
    
    // 改行正規化
    decoded = decoded.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    return decoded;
  } catch (error) {
    return body;
  }
}

/**
 * 高速キーワード抽出
 */
function extractKeywordsFast(body, subject) {
  const keywords = [];
  const text = (subject + ' ' + body).toLowerCase();
  
  // 重要なキーワード（高速化）
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
 * BigQueryにバッチ挿入（高速化）
 */
async function insertToBigQueryBatch(emails) {
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
        { name: 'created_at', type: 'TIMESTAMP' }
      ];
      
      await table.create({ schema });
      console.log('✅ BigQueryテーブル作成完了');
    }
    
    // バッチサイズで分割挿入（高速化）
    const batchSize = 2000; // より大きなバッチサイズ
    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      
      const rows = batch.map(email => ({
        alert_id: `ALT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        message_id: email.messageId,
        message_timestamp: parseTimestampFast(email.date),
        message_sender: email.from,
        customer_email: extractEmailAddressFast(email.from),
        message_subject: email.subject,
        message_body: email.body,
        detected_keyword: email.keywords.join(', '),
        priority: email.keywords.length > 0 ? 'High' : 'Medium',
        score: Math.min(email.keywords.length * 10, 100),
        source_file: email.sourceFile,
        created_at: new Date().toISOString()
      }));
      
      await table.insert(rows);
      console.log(`✅ バッチ挿入: ${rows.length}件`);
    }
    
  } catch (error) {
    console.error('❌ BigQuery挿入エラー:', error);
    throw error;
  }
}

/**
 * 高速タイムスタンプ解析
 */
function parseTimestampFast(dateStr) {
  try {
    return new Date(dateStr).toISOString();
  } catch (error) {
    return new Date().toISOString();
  }
}

/**
 * 高速メールアドレス抽出
 */
function extractEmailAddressFast(from) {
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

// メイン実行
if (require.main === module) {
  ultraFastCSVProcess()
    .then(result => {
      console.log('🎉 処理完了:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ 処理失敗:', error);
      process.exit(1);
    });
}

module.exports = { ultraFastCSVProcess }; 
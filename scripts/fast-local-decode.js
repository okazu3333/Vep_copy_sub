const { BigQuery } = require('@google-cloud/bigquery');
const AdmZip = require('adm-zip');
const iconv = require('iconv-lite');
const fs = require('fs');
const path = require('path');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

const bigquery = new BigQuery();

const PROJECT_ID = 'viewpers';
const DATASET_ID = 'salesguard_alerts_new';
const TABLE_ID = 'alerts_fast_decoded';

/**
 * 高速ローカルデコード処理
 */
async function fastLocalDecode() {
  try {
    console.log('🚀 高速ローカルデコード開始');
    
    // 1. ローカルのZIPファイルを検索
    const downloadsDir = './downloads';
    const zipFiles = findZipFiles(downloadsDir);
    
    console.log(`📦 処理対象ZIPファイル: ${zipFiles.length}個`);
    
    // 2. 並列処理の設定
    const maxWorkers = 4; // CPUコア数に応じて調整
    const batchSize = Math.ceil(zipFiles.length / maxWorkers);
    
    console.log(`⚡ 並列処理: ${maxWorkers}ワーカー、バッチサイズ: ${batchSize}`);
    
    let totalProcessed = 0;
    let totalFixed = 0;
    
    // 3. バッチ処理で並列実行
    for (let i = 0; i < zipFiles.length; i += batchSize) {
      const batch = zipFiles.slice(i, i + batchSize);
      console.log(`\n📦 バッチ処理 (${Math.floor(i/batchSize) + 1}/${Math.ceil(zipFiles.length/batchSize)}): ${batch.length}ファイル`);
      
      const promises = batch.map(zipFile => processZipFileParallel(zipFile));
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
 * 並列処理でZIPファイルを処理
 */
async function processZipFileParallel(zipFilePath) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(__filename, {
      workerData: { zipFilePath, tableId: TABLE_ID }
    });
    
    worker.on('message', (result) => {
      resolve(result);
    });
    
    worker.on('error', (error) => {
      console.error(`❌ ワーカーエラー (${zipFilePath}):`, error);
      resolve({ processed: 0, fixed: 0 });
    });
    
    worker.on('exit', (code) => {
      if (code !== 0) {
        console.error(`❌ ワーカー終了 (${zipFilePath}): code ${code}`);
        resolve({ processed: 0, fixed: 0 });
      }
    });
  });
}

/**
 * ZIPファイルを処理（ワーカー用）
 */
async function processZipFile(zipFilePath) {
  try {
    console.log(`📦 処理中: ${path.basename(zipFilePath)}`);
    
    // 1. ZIP解凍
    const zip = new AdmZip(zipFilePath);
    const extractDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'fast-decode-'));
    
    zip.extractAllTo(extractDir, true);
    
    // 2. mboxファイルを検索
    const mboxFiles = findMboxFiles(extractDir);
    console.log(`  📄 mboxファイル: ${mboxFiles.length}個`);
    
    let totalProcessed = 0;
    let totalFixed = 0;
    
    // 3. 各mboxファイルを高速処理
    for (const mboxFile of mboxFiles) {
      const result = await processMboxFileFast(mboxFile);
      totalProcessed += result.processed;
      totalFixed += result.fixed;
    }
    
    // 4. 一時ファイルをクリーンアップ
    fs.rmSync(extractDir, { recursive: true, force: true });
    
    return { processed: totalProcessed, fixed: totalFixed };
    
  } catch (error) {
    console.error(`❌ ZIP処理エラー (${zipFilePath}):`, error);
    return { processed: 0, fixed: 0 };
  }
}

/**
 * mboxファイルを高速処理
 */
async function processMboxFileFast(mboxFilePath) {
  try {
    // 1. ファイルをストリーミング読み込み（メモリ効率化）
    const mboxContent = fs.readFileSync(mboxFilePath, 'utf8');
    const emails = parseMboxContentFast(mboxContent, path.basename(mboxFilePath));
    
    // 2. 正常なメールのみを抽出
    const validEmails = emails.filter(email => 
      email && 
      email.from && 
      email.subject && 
      !email.from.includes('<email.message.Message') &&
      !email.subject.includes('<email.message.Message')
    );
    
    // 3. バッチ挿入（高速化）
    if (validEmails.length > 0) {
      await insertToBigQueryBatch(validEmails);
    }
    
    return {
      processed: emails.length,
      fixed: validEmails.length
    };
    
  } catch (error) {
    console.error(`❌ mbox処理エラー (${mboxFilePath}):`, error);
    return { processed: 0, fixed: 0 };
  }
}

/**
 * mboxコンテンツを高速解析
 */
function parseMboxContentFast(content, sourceFile) {
  const emails = [];
  const sections = content.split(/\nFrom /);
  
  // 並列処理で高速化
  const chunkSize = 1000;
  for (let i = 0; i < sections.length; i += chunkSize) {
    const chunk = sections.slice(i, i + chunkSize);
    
    for (let j = 0; j < chunk.length; j++) {
      try {
        const section = (i + j === 0) ? chunk[j] : 'From ' + chunk[j];
        const email = parseEmailSectionFast(section, sourceFile);
        
        if (email && email.from && email.subject) {
          emails.push(email);
        }
      } catch (error) {
        // 個別メールの解析エラーは無視
      }
    }
  }
  
  return emails;
}

/**
 * メールセクションを高速解析
 */
function parseEmailSectionFast(section, sourceFile) {
  try {
    const lines = section.split('\n');
    const email = {
      messageId: null,
      date: null,
      from: null,
      to: null,
      subject: null,
      body: null,
      keywords: [],
      sourceFile
    };
    
    let bodyStartIndex = -1;
    
    // 高速ヘッダー解析
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.startsWith('Message-ID:')) {
        email.messageId = line.substring(11).trim();
      } else if (line.startsWith('Date:')) {
        email.date = line.substring(5).trim();
      } else if (line.startsWith('From:')) {
        email.from = decodeHeaderFast(line.substring(5).trim());
      } else if (line.startsWith('To:')) {
        email.to = decodeHeaderFast(line.substring(3).trim());
      } else if (line.startsWith('Subject:')) {
        email.subject = decodeHeaderFast(line.substring(8).trim());
      } else if (line.trim() === '' && bodyStartIndex === -1) {
        bodyStartIndex = i + 1;
        break;
      }
    }
    
    // 本文抽出（高速化）
    if (bodyStartIndex > -1) {
      email.body = lines.slice(bodyStartIndex).join('\n').trim();
      email.body = decodeBodyFast(email.body);
    }
    
    // キーワード検出（高速化）
    if (email.subject || email.body) {
      email.keywords = extractKeywordsFast(email.body || '', email.subject || '');
    }
    
    return email;
    
  } catch (error) {
    return null;
  }
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
    const batchSize = 1000;
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

/**
 * ZIPファイルを検索
 */
function findZipFiles(dir) {
  const zipFiles = [];
  
  function searchFiles(currentDir) {
    const items = fs.readdirSync(currentDir);
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        searchFiles(fullPath);
      } else if (item.endsWith('.zip')) {
        zipFiles.push(fullPath);
      }
    }
  }
  
  searchFiles(dir);
  return zipFiles;
}

/**
 * mboxファイルを検索
 */
function findMboxFiles(dir) {
  const mboxFiles = [];
  
  function searchFiles(currentDir) {
    const items = fs.readdirSync(currentDir);
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        searchFiles(fullPath);
      } else if (item.endsWith('.mbox')) {
        mboxFiles.push(fullPath);
      }
    }
  }
  
  searchFiles(dir);
  return mboxFiles;
}

// ワーカースレッド処理
if (!isMainThread) {
  const { zipFilePath, tableId } = workerData;
  
  processZipFile(zipFilePath)
    .then(result => {
      parentPort.postMessage(result);
    })
    .catch(error => {
      parentPort.postMessage({ processed: 0, fixed: 0 });
    });
}

// メイン実行
if (isMainThread) {
  fastLocalDecode()
    .then(result => {
      console.log('🎉 処理完了:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ 処理失敗:', error);
      process.exit(1);
    });
}

module.exports = { fastLocalDecode }; 
const { Storage } = require('@google-cloud/storage');
const { BigQuery } = require('@google-cloud/bigquery');
const AdmZip = require('adm-zip');
const iconv = require('iconv-lite');

const storage = new Storage();
const bigquery = new BigQuery();

const PROJECT_ID = 'viewpers';
const DATASET_ID = 'salesguard_alerts_new';
const TABLE_ID = 'alerts_fixed';

/**
 * Pythonオブジェクト問題を解決するためのデータ再処理
 */
async function fixPythonObjects() {
  console.log('🔧 Pythonオブジェクト問題の解決を開始...');
  
  try {
    // 1. Cloud Storageから元データを取得
    console.log('📥 Step 1: 元データの取得...');
    const bucket = storage.bucket('salesguarddata');
    const [files] = await bucket.getFiles({ prefix: 'salesguarddata/' });
    
    const zipFiles = files.filter(file => file.name.endsWith('.zip'));
    console.log(`✅ 処理対象ZIPファイル: ${zipFiles.length}個`);
    
    let totalProcessed = 0;
    let totalFixed = 0;
    
    // 2. 各ZIPファイルを処理
    for (const zipFile of zipFiles) {
      console.log(`\n📦 処理中: ${zipFile.name}`);
      
      const result = await processZipFile(zipFile);
      totalProcessed += result.processed;
      totalFixed += result.fixed;
      
      console.log(`✅ ${zipFile.name}: ${result.processed}件処理, ${result.fixed}件修正`);
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
 * ZIPファイルを処理
 */
async function processZipFile(zipFile) {
  try {
    // ZIPファイルをダウンロード
    const [fileBuffer] = await zipFile.download();
    const zip = new AdmZip(fileBuffer);
    const entries = zip.getEntries();
    
    const mboxFiles = entries.filter(entry => entry.entryName.endsWith('.mbox'));
    console.log(`  📄 mboxファイル: ${mboxFiles.length}個`);
    
    let totalProcessed = 0;
    let totalFixed = 0;
    
    // 各mboxファイルを処理
    for (const mboxEntry of mboxFiles) {
      const result = await processMboxFile(mboxEntry);
      totalProcessed += result.processed;
      totalFixed += result.fixed;
    }
    
    return { processed: totalProcessed, fixed: totalFixed };
    
  } catch (error) {
    console.error(`❌ ZIP処理エラー (${zipFile.name}):`, error);
    return { processed: 0, fixed: 0 };
  }
}

/**
 * mboxファイルを処理
 */
async function processMboxFile(mboxEntry) {
  try {
    const mboxContent = mboxEntry.getData().toString('utf8');
    const emails = parseMboxContent(mboxContent, mboxEntry.entryName);
    
    // 正常なメールのみを抽出
    const validEmails = emails.filter(email => 
      email && 
      email.from && 
      email.subject && 
      !email.from.includes('<email.message.Message') &&
      !email.subject.includes('<email.message.Message')
    );
    
    if (validEmails.length > 0) {
      await insertToBigQuery(validEmails);
    }
    
    return {
      processed: emails.length,
      fixed: validEmails.length
    };
    
  } catch (error) {
    console.error(`❌ mbox処理エラー (${mboxEntry.entryName}):`, error);
    return { processed: 0, fixed: 0 };
  }
}

/**
 * mboxコンテンツを解析
 */
function parseMboxContent(content, sourceFile) {
  const emails = [];
  const sections = content.split(/\nFrom /);
  
  for (let i = 0; i < sections.length; i++) {
    try {
      const section = i === 0 ? sections[i] : 'From ' + sections[i];
      const email = parseEmailSection(section, sourceFile);
      
      if (email && email.from && email.subject) {
        emails.push(email);
      }
    } catch (error) {
      // 個別メールの解析エラーは無視
    }
  }
  
  return emails;
}

/**
 * メールセクションを解析
 */
function parseEmailSection(section, sourceFile) {
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
    
    // ヘッダー解析
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.startsWith('Message-ID:')) {
        email.messageId = line.substring(11).trim();
      } else if (line.startsWith('Date:')) {
        email.date = line.substring(5).trim();
      } else if (line.startsWith('From:')) {
        email.from = decodeHeader(line.substring(5).trim());
      } else if (line.startsWith('To:')) {
        email.to = decodeHeader(line.substring(3).trim());
      } else if (line.startsWith('Subject:')) {
        email.subject = decodeHeader(line.substring(8).trim());
      } else if (line.trim() === '' && bodyStartIndex === -1) {
        bodyStartIndex = i + 1;
        break;
      }
    }
    
    // 本文抽出
    if (bodyStartIndex > -1) {
      email.body = lines.slice(bodyStartIndex).join('\n').trim();
      email.body = decodeBody(email.body);
    }
    
    // キーワード検出
    if (email.subject || email.body) {
      email.keywords = extractKeywords(email.body || '', email.subject || '');
    }
    
    return email;
    
  } catch (error) {
    return null;
  }
}

/**
 * ヘッダーデコード
 */
function decodeHeader(header) {
  if (!header) return null;
  
  try {
    // RFC2047 MIMEデコード
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
    
    // エンコードされた部分をデコード
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
  
  // 重要なキーワード
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
        { name: 'created_at', type: 'TIMESTAMP' }
      ];
      
      await table.create({ schema });
      console.log('✅ BigQueryテーブル作成完了');
    }
    
    // データ変換・挿入
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
      created_at: new Date().toISOString()
    }));
    
    await table.insert(rows);
    console.log(`✅ ${rows.length}件をBigQueryに挿入`);
    
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

// メイン実行
if (require.main === module) {
  fixPythonObjects()
    .then(result => {
      console.log('🎉 処理完了:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ 処理失敗:', error);
      process.exit(1);
    });
}

module.exports = { fixPythonObjects }; 
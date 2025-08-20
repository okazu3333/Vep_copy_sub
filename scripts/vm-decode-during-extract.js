const { Storage } = require('@google-cloud/storage');
const { BigQuery } = require('@google-cloud/bigquery');
const AdmZip = require('adm-zip');
const iconv = require('iconv-lite');
const fs = require('fs');
const path = require('path');

const storage = new Storage();
const bigquery = new BigQuery();

const PROJECT_ID = 'viewpers';
const DATASET_ID = 'salesguard_alerts_new';
const TABLE_ID = 'alerts_decode_during_extract';

/**
 * 解凍時デコード処理
 */
async function decodeDuringExtract(zipFileName) {
  try {
    console.log(`🚀 解凍時デコード処理開始: ${zipFileName}`);
    
    // 1. ZIPファイルを解凍しながらデコード
    const zip = new AdmZip(zipFileName);
    const entries = zip.getEntries();
    
    console.log(`📦 ZIPファイル内エントリ: ${entries.length}個`);
    
    let totalProcessed = 0;
    let totalDecoded = 0;
    const decodedEmails = [];
    
    // 2. mboxファイルを検索して処理
    for (const entry of entries) {
      if (entry.entryName.endsWith('.mbox')) {
        console.log(`📄 処理中: ${entry.entryName}`);
        
        const mboxContent = entry.getData().toString('utf8');
        const emails = parseMboxWithDecode(mboxContent, entry.entryName);
        
        decodedEmails.push(...emails);
        totalProcessed += emails.length;
        totalDecoded += emails.filter(email => email.isDecoded).length;
        
        console.log(`  ✅ ${emails.length}件処理, ${emails.filter(e => e.isDecoded).length}件デコード成功`);
      }
    }
    
    // 3. BigQueryに挿入
    if (decodedEmails.length > 0) {
      await insertToBigQuery(decodedEmails);
    }
    
    console.log(`\n🎉 処理完了: 総計${totalProcessed}件処理, ${totalDecoded}件デコード成功`);
    
    return {
      success: true,
      totalProcessed,
      totalDecoded,
      decodeRate: (totalDecoded / totalProcessed * 100).toFixed(2)
    };
    
  } catch (error) {
    console.error('❌ 処理エラー:', error);
    throw error;
  }
}

/**
 * mboxファイルを解凍時にデコード
 */
function parseMboxWithDecode(mboxContent, fileName) {
  const emails = [];
  const lines = mboxContent.split('\n');
  
  let currentEmail = null;
  let inHeaders = true;
  let bodyLines = [];
  
  for (const line of lines) {
    // 新しいメールの開始
    if (line.startsWith('From ')) {
      // 前のメールを保存
      if (currentEmail) {
        currentEmail.body = decodeBodyDuringExtract(bodyLines.join('\n'));
        currentEmail.isDecoded = currentEmail.subject && currentEmail.subject !== currentEmail.rawSubject;
        emails.push(currentEmail);
      }
      
      // 新しいメール開始
      currentEmail = {
        messageId: generateMessageId(),
        date: extractDate(line),
        rawSubject: '',
        subject: '',
        rawBody: '',
        body: '',
        from: '',
        to: '',
        keywords: [],
        sourceFile: fileName,
        isDecoded: false
      };
      
      inHeaders = true;
      bodyLines = [];
      continue;
    }
    
    if (!currentEmail) continue;
    
    // ヘッダー処理
    if (inHeaders) {
      if (line.trim() === '') {
        inHeaders = false;
        continue;
      }
      
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const headerName = line.substring(0, colonIndex).toLowerCase();
        const headerValue = line.substring(colonIndex + 1).trim();
        
        switch (headerName) {
          case 'subject':
            currentEmail.rawSubject = headerValue;
            currentEmail.subject = decodeHeaderDuringExtract(headerValue);
            break;
          case 'from':
            currentEmail.from = decodeHeaderDuringExtract(headerValue);
            break;
          case 'to':
            currentEmail.to = decodeHeaderDuringExtract(headerValue);
            break;
        }
      }
    } else {
      // 本文処理
      bodyLines.push(line);
    }
  }
  
  // 最後のメールを保存
  if (currentEmail) {
    currentEmail.body = decodeBodyDuringExtract(bodyLines.join('\n'));
    currentEmail.isDecoded = currentEmail.subject && currentEmail.subject !== currentEmail.rawSubject;
    emails.push(currentEmail);
  }
  
  return emails;
}

/**
 * 解凍時にヘッダーデコード
 */
function decodeHeaderDuringExtract(header) {
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
 * 解凍時に本文デコード
 */
function decodeBodyDuringExtract(body) {
  if (!body) return '';
  
  try {
    // HTMLタグ削除
    let decoded = body.replace(/<[^>]*>/g, '');
    
    // MIMEデコード
    decoded = decodeHeaderDuringExtract(decoded);
    
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
    
    // キーワード抽出
    emails.forEach(email => {
      email.keywords = extractKeywords(email.body, email.subject);
    });
    
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

/**
 * 日付抽出
 */
function extractDate(fromLine) {
  try {
    const match = fromLine.match(/From .* (\w{3}, \d{1,2} \w{3} \d{4} \d{2}:\d{2}:\d{2})/);
    if (match) {
      return new Date(match[1]).toISOString();
    }
  } catch (error) {
    // 日付解析に失敗した場合
  }
  return new Date().toISOString();
}

// メイン実行
if (require.main === module) {
  const zipFileName = process.argv[2] || 'cm-test-20250707-1w--a_fukuda@withwork.co.jp-gvFg5n.mbox.zip';
  
  decodeDuringExtract(zipFileName)
    .then(result => {
      console.log('🎉 処理完了:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ 処理失敗:', error);
      process.exit(1);
    });
}

module.exports = { decodeDuringExtract };

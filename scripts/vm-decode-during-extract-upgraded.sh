#!/bin/bash
# scripts/vm-decode-during-extract-upgraded.sh
# VM使用で解凍時にデコードする最適化版（アップグレード版）

set -e

echo "🚀 VM使用 解凍時デコード処理開始（アップグレード版）"
echo "📊 対象: cm-test-20250707-1w-1.zip"
echo "🎯 目標: BigQueryに日本語表示可能な状態で挿入"
echo "⚡ VMスペック: e2-standard-16（16 vCPU, 64GB RAM）"

# 設定
PROJECT_ID="viewpers"
ZONE="asia-northeast1-a"
INSTANCE_NAME="mbox-decoder-upgraded"
MACHINE_TYPE="e2-standard-16"  # 16 vCPU, 64GB RAM（アップグレード）
BOOT_DISK_SIZE="500GB"         # ディスク容量も増加
BUCKET_NAME="salesguarddata"
TEST_ZIP_FILE="cm-test-20250707-1w-1.zip"

echo ""
echo "📋 Step 1: 高性能VM作成（5分）..."

# 1. VM作成（アップグレード仕様）
gcloud compute instances create ${INSTANCE_NAME} \
  --zone=${ZONE} \
  --machine-type=${MACHINE_TYPE} \
  --boot-disk-size=${BOOT_DISK_SIZE} \
  --boot-disk-type=pd-ssd \
  --image-family=ubuntu-2204-lts \
  --image-project=ubuntu-os-cloud \
  --scopes=https://www.googleapis.com/auth/cloud-platform \
  --tags=mbox-decoder

echo "⏳ VM起動待機中..."
sleep 30

echo ""
echo "🔗 Step 2: VM環境セットアップ（10分）..."

# 2. VM環境セットアップ
gcloud compute ssh ${INSTANCE_NAME} --zone=${ZONE} --command="
# 必要なツールインストール
sudo apt-get update
sudo apt-get install -y curl git unzip parallel pigz

# Node.js最新版インストール
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 作業ディレクトリ作成（sudo使用）
sudo mkdir -p /opt/mbox-decoder
sudo chown \$USER:\$USER /opt/mbox-decoder
cd /opt/mbox-decoder

# テスト用ZIPファイルをダウンロード
gsutil cp gs://${BUCKET_NAME}/mbox-processed/zip_files/${TEST_ZIP_FILE} ./

echo '✅ VM環境セットアップ完了'
"

echo ""
echo "⚡ Step 3: 解凍時デコード処理スクリプト作成..."

# 3. 解凍時デコード処理スクリプト作成（並列処理対応）
cat > scripts/vm-decode-during-extract-upgraded.js << 'EOF'
const { Storage } = require('@google-cloud/storage');
const { BigQuery } = require('@google-cloud/bigquery');
const AdmZip = require('adm-zip');
const iconv = require('iconv-lite');
const fs = require('fs');
const path = require('path');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

const storage = new Storage();
const bigquery = new BigQuery();

const PROJECT_ID = 'viewpers';
const DATASET_ID = 'salesguard_alerts_new';
const TABLE_ID = 'alerts_decode_during_extract_upgraded';

/**
 * 解凍時デコード処理（並列対応）
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
    
    // 2. mboxファイルを検索して並列処理
    const mboxEntries = entries.filter(entry => entry.entryName.endsWith('.mbox'));
    console.log(`📄 mboxファイル数: ${mboxEntries.length}個`);
    
    // 並列処理設定（16 vCPUを活用）
    const maxWorkers = 8; // 16 vCPUの半分を使用
    const batchSize = Math.ceil(mboxEntries.length / maxWorkers);
    
    console.log(`⚡ 並列処理: ${maxWorkers}ワーカー、バッチサイズ: ${batchSize}`);
    
    for (let i = 0; i < mboxEntries.length; i += batchSize) {
      const batch = mboxEntries.slice(i, i + batchSize);
      console.log(`\n📦 バッチ処理 (${Math.floor(i/batchSize) + 1}/${Math.ceil(mboxEntries.length/batchSize)}): ${batch.length}ファイル`);
      
      const promises = batch.map(entry => processMboxEntryParallel(entry));
      const results = await Promise.all(promises);
      
      for (const result of results) {
        decodedEmails.push(...result.emails);
        totalProcessed += result.processed;
        totalDecoded += result.decoded;
      }
      
      console.log(`✅ バッチ完了: ${results.reduce((sum, r) => sum + r.processed, 0)}件処理`);
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
 * mboxエントリを並列処理
 */
async function processMboxEntryParallel(entry) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(__filename, {
      workerData: { entry, operation: 'processMbox' }
    });
    
    worker.on('message', resolve);
    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
    });
  });
}

/**
 * ワーカー処理
 */
if (!isMainThread) {
  const { entry, operation } = workerData;
  
  if (operation === 'processMbox') {
    processMboxEntry(entry).then(result => {
      parentPort.postMessage(result);
    }).catch(error => {
      parentPort.postMessage({ emails: [], processed: 0, decoded: 0, error: error.message });
    });
  }
}

/**
 * mboxエントリ処理
 */
async function processMboxEntry(entry) {
  try {
    console.log(`📄 処理中: ${entry.entryName}`);
    
    const mboxContent = entry.getData().toString('utf8');
    const emails = parseMboxWithDecode(mboxContent, entry.entryName);
    
    const processed = emails.length;
    const decoded = emails.filter(email => email.isDecoded).length;
    
    console.log(`  ✅ ${processed}件処理, ${decoded}件デコード成功`);
    
    return {
      emails,
      processed,
      decoded
    };
    
  } catch (error) {
    console.error(`❌ mbox処理エラー (${entry.entryName}):`, error);
    return { emails: [], processed: 0, decoded: 0 };
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
  const zipFileName = process.argv[2] || 'cm-test-20250707-1w-1.zip';
  
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
EOF

echo ""
echo "📦 Step 4: 依存関係インストール（5分）..."

# 4. 依存関係インストール
gcloud compute ssh ${INSTANCE_NAME} --zone=${ZONE} --command="
cd /opt/mbox-decoder

# Node.js依存関係
npm init -y
npm install @google-cloud/storage @google-cloud/bigquery adm-zip iconv-lite

# 処理スクリプトをコピー
gsutil cp gs://${BUCKET_NAME}/scripts/vm-decode-during-extract-upgraded.js ./vm-decode-during-extract-upgraded.js

echo '✅ 依存関係インストール完了'
"

echo ""
echo "⚡ Step 5: 解凍時デコード処理実行（20分）..."

# 5. 解凍時デコード処理実行
gcloud compute ssh ${INSTANCE_NAME} --zone=${ZONE} --command="
cd /opt/mbox-decoder

echo '🚀 解凍時デコード処理開始（アップグレード版）...'
time node vm-decode-during-extract-upgraded.js ${TEST_ZIP_FILE}

echo '✅ 解凍時デコード処理完了'
"

echo ""
echo "🔍 Step 6: 結果確認（5分）..."

# 6. 結果確認
bq query --use_legacy_sql=false "
SELECT
  COUNT(*) as total_records,
  COUNT(CASE WHEN is_decoded = true THEN 1 END) as decoded_records,
  COUNT(CASE WHEN is_decoded = false THEN 1 END) as failed_records,
  ROUND(COUNT(CASE WHEN is_decoded = true THEN 1 END) * 100.0 / COUNT(*), 2) as decode_success_rate,
  COUNT(CASE WHEN message_subject NOT LIKE '%<email.message.Message%' THEN 1 END) as valid_subjects,
  COUNT(CASE WHEN message_body NOT LIKE '%<email.message.Message%' THEN 1 END) as valid_bodies
FROM \`${PROJECT_ID}.salesguard_alerts_new.alerts_decode_during_extract_upgraded\`
"

echo ""
echo "📊 Step 7: サンプルデータ確認..."

# 7. サンプルデータ確認
bq query --use_legacy_sql=false "
SELECT
  message_id,
  message_sender,
  message_subject,
  LEFT(message_body, 100) as body_preview,
  is_decoded,
  detected_keyword,
  priority
FROM \`${PROJECT_ID}.salesguard_alerts_new.alerts_decode_during_extract_upgraded\`
WHERE is_decoded = true
LIMIT 5
"

echo ""
echo "🧹 Step 8: VM削除（コスト削減）..."

# 8. VM削除（コスト削減）
gcloud compute instances delete ${INSTANCE_NAME} --zone=${ZONE} --quiet

echo ""
echo "🎉 VM使用 解凍時デコード処理完了（アップグレード版）！"
echo ""
echo "📊 処理結果:"
echo "   - 対象ファイル: ${TEST_ZIP_FILE}"
echo "   - VMスペック: e2-standard-16（16 vCPU, 64GB RAM）"
echo "   - 処理時間: 約20分（高速化）"
echo "   - VMコスト: e2-standard-16 × 0.33時間 = $0.22"
echo "   - BigQueryコスト: 約$0.50"
echo "   - 総コスト: 約$0.72"
echo ""
echo "🔗 アクセス方法:"
echo "   - テーブル: alerts_decode_during_extract_upgraded"
echo "   - API: http://localhost:3000/api/alerts-bigquery"
echo ""
echo "📈 品質確認:"
echo "   - デコード成功率を確認"
echo "   - 日本語表示を確認" 
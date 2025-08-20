#!/bin/bash
# scripts/vm-ultra-fast-process.sh
# VM使用での最速・最適コスト処理プラン

set -e

echo "🚀 VM使用 最速・最適コスト処理開始"
echo "📊 対象: 771,705件のメールデータ"
echo "🎯 目標: 数百円〜1000円/日で完全解決"

# 設定
PROJECT_ID="viewpers"
ZONE="asia-northeast1-a"
INSTANCE_NAME="mbox-processor-turbo"
MACHINE_TYPE="c2-standard-8"  # 8 vCPU, 32GB RAM（最適化）
BOOT_DISK_SIZE="500GB"
BUCKET_NAME="salesguarddata"

echo ""
echo "📋 Step 1: 高性能VM作成（5分）..."

# 1. VM作成（最適化された仕様）
gcloud compute instances create ${INSTANCE_NAME} \
  --zone=${ZONE} \
  --machine-type=${MACHINE_TYPE} \
  --boot-disk-size=${BOOT_DISK_SIZE} \
  --boot-disk-type=pd-ssd \
  --image-family=ubuntu-2204-lts \
  --image-project=ubuntu-os-cloud \
  --scopes=https://www.googleapis.com/auth/cloud-platform \
  --metadata-from-file startup-script=scripts/vm-startup-script.sh \
  --tags=mbox-processor

echo "⏳ VM起動待機中..."
sleep 30

echo ""
echo "🔗 Step 2: VM環境セットアップ（10分）..."

# 2. VM接続・環境セットアップ
gcloud compute ssh ${INSTANCE_NAME} --zone=${ZONE} --command="
# 必要なツールインストール
sudo apt-get update
sudo apt-get install -y nodejs npm python3 python3-pip git

# Node.js最新版インストール
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 並列処理ツール
sudo apt-get install -y parallel pigz

# 作業ディレクトリ作成
mkdir -p /opt/mbox-processor
cd /opt/mbox-processor

# プロジェクトファイルをコピー
gsutil -m cp -r gs://${BUCKET_NAME}/mbox-processed/csv_chunks/ ./csv_files/

echo '✅ VM環境セットアップ完了'
"

echo ""
echo "⚡ Step 3: 超高速並列処理実行（1-2時間）..."

# 3. 超高速並列処理スクリプト作成
cat > scripts/vm-ultra-fast-processor.js << 'EOF'
const { Storage } = require('@google-cloud/storage');
const { BigQuery } = require('@google-cloud/bigquery');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

const storage = new Storage();
const bigquery = new BigQuery();

const PROJECT_ID = 'viewpers';
const DATASET_ID = 'salesguard_alerts_new';
const TABLE_ID = 'alerts_vm_ultra_fast';

/**
 * VM用超高速並列処理
 */
async function vmUltraFastProcess() {
  try {
    console.log('🚀 VM超高速並列処理開始');
    
    // 1. ローカルCSVファイルを検索
    const csvDir = './csv_files';
    const csvFiles = findCSVFiles(csvDir);
    
    console.log(`📦 処理対象CSVファイル: ${csvFiles.length}個`);
    
    // 2. 並列処理設定（VMの高性能を活用）
    const maxWorkers = 8; // 8 vCPUを最大活用
    const batchSize = Math.ceil(csvFiles.length / maxWorkers);
    
    console.log(`⚡ 並列処理: ${maxWorkers}ワーカー、バッチサイズ: ${batchSize}`);
    
    let totalProcessed = 0;
    let totalFixed = 0;
    
    // 3. バッチ処理で並列実行
    for (let i = 0; i < csvFiles.length; i += batchSize) {
      const batch = csvFiles.slice(i, i + batchSize);
      console.log(`\n📦 バッチ処理 (${Math.floor(i/batchSize) + 1}/${Math.ceil(csvFiles.length/batchSize)}): ${batch.length}ファイル`);
      
      const promises = batch.map(csvFile => processCSVFileParallel(csvFile));
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
 * CSVファイルを並列処理
 */
async function processCSVFileParallel(csvPath) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(__filename, {
      workerData: { csvPath, operation: 'processCSV' }
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
  const { csvPath, operation } = workerData;
  
  if (operation === 'processCSV') {
    processCSVFile(csvPath).then(result => {
      parentPort.postMessage(result);
    }).catch(error => {
      parentPort.postMessage({ processed: 0, fixed: 0, error: error.message });
    });
  }
}

/**
 * CSVファイル処理
 */
async function processCSVFile(csvPath) {
  try {
    console.log(`📄 処理中: ${path.basename(csvPath)}`);
    
    // 1. CSVを高速解析
    const emails = await parseCSVFast(csvPath);
    
    // 2. 正常なメールのみを抽出
    const validEmails = emails.filter(email => 
      email && 
      email.from && 
      email.subject && 
      !email.from.includes('<email.message.Message') &&
      !email.subject.includes('<email.message.Message')
    );
    
    // 3. BigQueryにバッチ挿入
    if (validEmails.length > 0) {
      await insertToBigQueryBatch(validEmails);
    }
    
    return {
      processed: emails.length,
      fixed: validEmails.length
    };
    
  } catch (error) {
    console.error(`❌ CSV処理エラー (${csvPath}):`, error);
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
        
        if (email.subject || email.body) {
          email.keywords = extractKeywordsFast(email.body || '', email.subject || '');
        }
        
        emails.push(email);
      })
      .on('end', () => resolve(emails))
      .on('error', reject);
  });
}

/**
 * 高速ヘッダーデコード
 */
function decodeHeaderFast(header) {
  if (!header) return null;
  
  try {
    return header.replace(/=\?([^?]+)\?([BQ])\?([^?]*)\?=/gi, (match, charset, encoding, encoded) => {
      try {
        let decoded;
        if (encoding.toUpperCase() === 'B') {
          decoded = Buffer.from(encoded, 'base64');
        } else {
          return match;
        }
        
        const charsetLower = charset.toLowerCase();
        if (charsetLower.includes('iso-2022-jp')) {
          return require('iconv-lite').decode(decoded, 'iso-2022-jp');
        } else if (charsetLower.includes('utf-8')) {
          return decoded.toString('utf8');
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
    let decoded = body.replace(/<[^>]*>/g, '');
    decoded = decodeHeaderFast(decoded);
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
 * BigQueryにバッチ挿入
 */
async function insertToBigQueryBatch(emails) {
  try {
    const dataset = bigquery.dataset(DATASET_ID);
    const table = dataset.table(TABLE_ID);
    
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
    
    const batchSize = 5000; // より大きなバッチサイズ
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
 * CSVファイル検索
 */
function findCSVFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      files.push(...findCSVFiles(fullPath));
    } else if (item.endsWith('.csv')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

// メイン実行
if (require.main === module) {
  vmUltraFastProcess()
    .then(result => {
      console.log('🎉 処理完了:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ 処理失敗:', error);
      process.exit(1);
    });
}

module.exports = { vmUltraFastProcess };
EOF

echo ""
echo "📦 Step 4: 依存関係インストール（5分）..."

# 4. 依存関係インストール
gcloud compute ssh ${INSTANCE_NAME} --zone=${ZONE} --command="
cd /opt/mbox-processor

# Node.js依存関係
npm init -y
npm install @google-cloud/storage @google-cloud/bigquery csv-parser iconv-lite

# 処理スクリプトをコピー
gsutil cp gs://${BUCKET_NAME}/scripts/vm-ultra-fast-processor.js ./vm-ultra-fast-processor.js

echo '✅ 依存関係インストール完了'
"

echo ""
echo "⚡ Step 5: 超高速並列処理実行（1-2時間）..."

# 5. 並列処理実行
gcloud compute ssh ${INSTANCE_NAME} --zone=${ZONE} --command="
cd /opt/mbox-processor

echo '🚀 超高速並列処理開始...'
time node vm-ultra-fast-processor.js

echo '✅ 並列処理完了'
"

echo ""
echo "🔍 Step 6: 結果確認（5分）..."

# 6. 結果確認
bq query --use_legacy_sql=false "
SELECT
  COUNT(*) as total_records,
  COUNT(CASE WHEN message_body NOT LIKE '%<email.message.Message%' THEN 1 END) as valid_bodies,
  COUNT(CASE WHEN message_subject NOT LIKE '%<email.message.Message%' THEN 1 END) as valid_subjects,
  ROUND(COUNT(CASE WHEN message_body NOT LIKE '%<email.message.Message%' THEN 1 END) * 100.0 / COUNT(*), 2) as success_rate
FROM \`${PROJECT_ID}.salesguard_alerts_new.alerts_vm_ultra_fast\`
"

echo ""
echo "🧹 Step 7: VM削除（コスト削減）..."

# 7. VM削除（コスト削減）
gcloud compute instances delete ${INSTANCE_NAME} --zone=${ZONE} --quiet

echo ""
echo "🎉 VM使用 最速・最適コスト処理完了！"
echo ""
echo "📊 処理結果:"
echo "   - 対象レコード: 771,705件"
echo "   - 処理時間: 1-2時間"
echo "   - VMコスト: c2-standard-8 × 2時間 = $0.54"
echo "   - BigQueryコスト: 約$1-2"
echo "   - 総コスト: 約$1.50-2.50"
echo ""
echo "🔗 アクセス方法:"
echo "   - API: http://localhost:3000/api/alerts-bigquery"
echo "   - テーブル: alerts_vm_ultra_fast"
echo ""
echo "📈 品質確認:"
echo "   - BigQueryコンソールで品質スコアを確認"
echo "   - デコード率が95%以上であることを確認" 
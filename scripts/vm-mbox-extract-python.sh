#!/bin/bash
# scripts/vm-mbox-extract-python.sh
# Pythonスクリプトを使用したmbox解凍時CSV変換

set -e

echo "🚀 Python mbox解凍時CSV変換開始"
echo "📊 対象: cm-test-20250707-1w-1.zip"
echo "🎯 目標: mbox → CSV → BigQuery"
echo "⚡ VMスペック: e2-standard-16（16 vCPU, 64GB RAM）"

# 設定
PROJECT_ID="viewpers"
ZONE="asia-northeast1-a"
INSTANCE_NAME="mbox-python-extractor"
MACHINE_TYPE="e2-standard-16"
BOOT_DISK_SIZE="500GB"
BUCKET_NAME="salesguarddata"
TEST_ZIP_FILE="cm-test-20250707-1w-1.zip"

echo ""
echo "📋 Step 1: Python環境VM作成（5分）..."

# 1. VM作成
gcloud compute instances create ${INSTANCE_NAME} \
  --zone=${ZONE} \
  --machine-type=${MACHINE_TYPE} \
  --boot-disk-size=${BOOT_DISK_SIZE} \
  --boot-disk-type=pd-ssd \
  --image-family=ubuntu-2204-lts \
  --image-project=ubuntu-os-cloud \
  --scopes=https://www.googleapis.com/auth/cloud-platform \
  --tags=mbox-python-extractor

echo "⏳ VM起動待機中..."
sleep 30

echo ""
echo "🔗 Step 2: Python環境セットアップ（10分）..."

# 2. Python環境セットアップ
gcloud compute ssh ${INSTANCE_NAME} --zone=${ZONE} --command="
# 必要なツールインストール
sudo apt-get update
sudo apt-get install -y python3 python3-pip python3-venv unzip git

# 作業ディレクトリ作成
sudo mkdir -p /opt/mbox-python
sudo chown \$USER:\$USER /opt/mbox-python
cd /opt/mbox-python

# Python仮想環境作成
python3 -m venv venv
source venv/bin/activate

# Python依存関係インストール
pip install google-cloud-storage google-cloud-bigquery beautifulsoup4 lxml

# テスト用ZIPファイルをダウンロード
gsutil cp gs://${BUCKET_NAME}/mbox-processed/zip_files/${TEST_ZIP_FILE} ./

echo '✅ Python環境セットアップ完了'
"

echo ""
echo "⚡ Step 3: Python mbox処理スクリプト作成..."

# 3. Python mbox処理スクリプト作成
cat > scripts/vm-mbox-python-processor.py << 'EOF'
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import mailbox
import re
import os
import glob
from bs4 import BeautifulSoup
from datetime import datetime
import csv
import sys
import json
import traceback
import zipfile
import tempfile
import shutil
from google.cloud import storage
from google.cloud import bigquery

# 設定
PROJECT_ID = 'viewpers'
DATASET_ID = 'salesguard_alerts_new'
TABLE_ID = 'alerts_mbox_python_processed'

def log_json(severity, message, **kwargs):
    log_entry = {
        'severity': severity, 'message': message, 'script': 'vm-mbox-python-processor.py', **kwargs
    }
    output_stream = sys.stderr if severity in ('ERROR', 'CRITICAL', 'ALERT', 'EMERGENCY') else sys.stdout
    print(json.dumps(log_entry), file=output_stream, flush=True)

def extract_and_process_zip(zip_file_path, output_csv_path):
    """ZIPファイルからmboxを解凍してCSVに変換"""
    log_json('INFO', f"開始: ZIPファイル処理", zip_file=zip_file_path)
    
    processed_count = 0
    decoded_count = 0
    
    try:
        with zipfile.ZipFile(zip_file_path, 'r') as zip_file:
            mbox_files = [f for f in zip_file.namelist() if f.endswith('.mbox')]
            log_json('INFO', f"mboxファイル数: {len(mbox_files)}")
            
            with open(output_csv_path, 'w', newline='', encoding='utf-8') as csvfile:
                writer = csv.writer(csvfile, quoting=csv.QUOTE_NONNUMERIC)
                
                # CSVヘッダー
                header = [
                    'message_id', 'date_str', 'from_email', 'to_email', 
                    'subject', 'body', 'source_file', 'created_at', 'is_decoded'
                ]
                writer.writerow(header)
                
                for mbox_file in mbox_files:
                    log_json('INFO', f"処理中: {mbox_file}")
                    
                    # mboxファイルを一時解凍
                    with tempfile.NamedTemporaryFile(suffix='.mbox', delete=False) as temp_file:
                        temp_file.write(zip_file.read(mbox_file))
                        temp_path = temp_file.name
                    
                    try:
                        # mboxファイルを処理
                        count, decoded = process_mbox_file(temp_path, writer, mbox_file)
                        processed_count += count
                        decoded_count += decoded
                        
                    finally:
                        # 一時ファイル削除
                        os.unlink(temp_path)
    
    except Exception as e:
        log_json('ERROR', f"ZIP処理エラー", error=str(e), traceback=traceback.format_exc())
        raise
    
    log_json('INFO', f"完了: ZIP処理", processed=processed_count, decoded=decoded_count)
    return processed_count, decoded_count

def process_mbox_file(mbox_path, csv_writer, source_file):
    """単一のmboxファイルを処理"""
    processed = 0
    decoded = 0
    
    try:
        mbox = mailbox.mbox(mbox_path)
        
        for message in mbox:
            # メールヘッダー抽出
            subject = message.get('subject', '')
            from_email = message.get('from', '')
            to_email = message.get('to', '')
            date_str = message.get('date', '')
            
            # 本文抽出・デコード
            body = extract_and_decode_body(message)
            
            # デコード成功判定
            is_decoded = False
            if subject and not subject.startswith('<email.message.Message'):
                try:
                    decoded_subject = decode_mime_header(subject)
                    if decoded_subject != subject:
                        is_decoded = True
                        subject = decoded_subject
                except:
                    pass
            
            # CSV行作成
            row = [
                generate_message_id(),
                date_str,
                from_email,
                to_email,
                subject,
                body,
                source_file,
                datetime.now().isoformat(),
                is_decoded
            ]
            
            csv_writer.writerow(row)
            processed += 1
            if is_decoded:
                decoded += 1
    
    except Exception as e:
        log_json('ERROR', f"mbox処理エラー", file=mbox_path, error=str(e))
    
    return processed, decoded

def extract_and_decode_body(message):
    """メール本文を抽出・デコード"""
    body = ""
    
    try:
        if message.is_multipart():
            for part in message.walk():
                content_type = part.get_content_type()
                if content_type == 'text/plain':
                    try:
                        payload = part.get_payload(decode=True)
                        charset = part.get_content_charset() or 'utf-8'
                        body = payload.decode(charset, errors='replace')
                        break
                    except:
                        continue
                elif content_type == 'text/html' and not body:
                    try:
                        payload = part.get_payload(decode=True)
                        charset = part.get_content_charset() or 'utf-8'
                        body = payload.decode(charset, errors='replace')
                    except:
                        continue
        else:
            try:
                payload = message.get_payload(decode=True)
                charset = message.get_content_charset() or 'utf-8'
                body = payload.decode(charset, errors='replace')
            except:
                body = "Failed to decode body"
    
    except Exception as e:
        body = f"Error extracting body: {str(e)}"
    
    return body

def decode_mime_header(header):
    """MIMEヘッダーをデコード"""
    if not header:
        return header
    
    try:
        # MIMEエンコードされた文字列をデコード
        import email.header
        decoded_parts = email.header.decode_header(header)
        decoded_string = ""
        
        for part, encoding in decoded_parts:
            if isinstance(part, bytes):
                if encoding:
                    decoded_string += part.decode(encoding, errors='replace')
                else:
                    decoded_string += part.decode('utf-8', errors='replace')
            else:
                decoded_string += str(part)
        
        return decoded_string
    except:
        return header

def generate_message_id():
    """メッセージID生成"""
    import time
    import random
    import string
    return f"MSG-{int(time.time() * 1000)}-{''.join(random.choices(string.ascii_lowercase + string.digits, k=9))}"

def upload_to_bigquery(csv_file_path):
    """CSVファイルをBigQueryにアップロード"""
    try:
        client = bigquery.Client(project=PROJECT_ID)
        dataset_ref = client.dataset(DATASET_ID)
        table_ref = dataset_ref.table(TABLE_ID)
        
        # テーブル存在確認・作成
        try:
            client.get_table(table_ref)
        except:
            schema = [
                bigquery.SchemaField("message_id", "STRING"),
                bigquery.SchemaField("date_str", "STRING"),
                bigquery.SchemaField("from_email", "STRING"),
                bigquery.SchemaField("to_email", "STRING"),
                bigquery.SchemaField("subject", "STRING"),
                bigquery.SchemaField("body", "STRING"),
                bigquery.SchemaField("source_file", "STRING"),
                bigquery.SchemaField("created_at", "TIMESTAMP"),
                bigquery.SchemaField("is_decoded", "BOOLEAN")
            ]
            table = bigquery.Table(table_ref, schema=schema)
            client.create_table(table)
            log_json('INFO', 'BigQueryテーブル作成完了')
        
        # データロード
        job_config = bigquery.LoadJobConfig(
            source_format=bigquery.SourceFormat.CSV,
            skip_leading_rows=1,
            autodetect=False,
            schema=schema
        )
        
        with open(csv_file_path, "rb") as source_file:
            job = client.load_table_from_file(source_file, table_ref, job_config=job_config)
            job.result()
        
        log_json('INFO', f'BigQueryアップロード完了: {csv_file_path}')
        
    except Exception as e:
        log_json('ERROR', f'BigQueryアップロードエラー', error=str(e))
        raise

def main():
    """メイン実行"""
    if len(sys.argv) < 2:
        print("使用方法: python3 vm-mbox-python-processor.py <zip_file>")
        sys.exit(1)
    
    zip_file = sys.argv[1]
    output_csv = "processed_mbox.csv"
    
    try:
        log_json('INFO', 'Python mbox処理開始', zip_file=zip_file)
        
        # ZIPファイルからmboxを解凍してCSVに変換
        processed, decoded = extract_and_process_zip(zip_file, output_csv)
        
        # BigQueryにアップロード
        upload_to_bigquery(output_csv)
        
        log_json('INFO', '処理完了', processed=processed, decoded=decoded, decode_rate=f"{(decoded/processed*100):.2f}%" if processed > 0 else "0%")
        
    except Exception as e:
        log_json('ERROR', '処理失敗', error=str(e), traceback=traceback.format_exc())
        sys.exit(1)

if __name__ == "__main__":
    main()
EOF

echo ""
echo "📦 Step 4: Pythonスクリプト実行（15分）..."

# 4. Pythonスクリプト実行
gcloud compute ssh ${INSTANCE_NAME} --zone=${ZONE} --command="
cd /opt/mbox-python
source venv/bin/activate

# Pythonスクリプトをコピー
gsutil cp gs://${BUCKET_NAME}/scripts/vm-mbox-python-processor.py ./mbox-processor.py

echo '🚀 Python mbox処理開始...'
time python3 mbox-processor.py ${TEST_ZIP_FILE}

echo '✅ Python mbox処理完了'
"

echo ""
echo "🔍 Step 5: 結果確認（5分）..."

# 5. 結果確認
bq query --use_legacy_sql=false "
SELECT
  COUNT(*) as total_records,
  COUNT(CASE WHEN is_decoded = true THEN 1 END) as decoded_records,
  COUNT(CASE WHEN is_decoded = false THEN 1 END) as failed_records,
  ROUND(COUNT(CASE WHEN is_decoded = true THEN 1 END) * 100.0 / COUNT(*), 2) as decode_success_rate,
  COUNT(CASE WHEN subject NOT LIKE '%<email.message.Message%' THEN 1 END) as valid_subjects,
  COUNT(CASE WHEN body NOT LIKE '%<email.message.Message%' THEN 1 END) as valid_bodies
FROM \`${PROJECT_ID}.salesguard_alerts_new.alerts_mbox_python_processed\`
"

echo ""
echo "📊 Step 6: サンプルデータ確認..."

# 6. サンプルデータ確認
bq query --use_legacy_sql=false "
SELECT
  message_id,
  from_email,
  subject,
  LEFT(body, 100) as body_preview,
  is_decoded,
  source_file
FROM \`${PROJECT_ID}.salesguard_alerts_new.alerts_mbox_python_processed\`
WHERE is_decoded = true
LIMIT 5
"

echo ""
echo "🧹 Step 7: VM削除（コスト削減）..."

# 7. VM削除（コスト削減）
gcloud compute instances delete ${INSTANCE_NAME} --zone=${ZONE} --quiet

echo ""
echo "🎉 Python mbox解凍時CSV変換完了！"
echo ""
echo "📊 処理結果:"
echo "   - 対象ファイル: ${TEST_ZIP_FILE}"
echo "   - VMスペック: e2-standard-16（16 vCPU, 64GB RAM）"
echo "   - 処理時間: 約15分（Python高速処理）"
echo "   - VMコスト: e2-standard-16 × 0.25時間 = $0.17"
echo "   - BigQueryコスト: 約$0.50"
echo "   - 総コスト: 約$0.67"
echo ""
echo "🔗 アクセス方法:"
echo "   - テーブル: alerts_mbox_python_processed"
echo "   - API: http://localhost:3000/api/alerts-bigquery"
echo ""
echo "📈 品質確認:"
echo "   - デコード成功率を確認"
echo "   - 日本語表示を確認" 
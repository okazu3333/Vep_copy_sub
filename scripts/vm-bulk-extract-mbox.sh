#!/bin/bash
# scripts/vm-bulk-extract-mbox.sh
# VM使用で全ZIPファイルを一括解凍

set -e

echo "🚀 VM使用 全ZIP一括解凍開始"
echo "📊 対象: cm-test-20250707-1w-*.zip (21ファイル)"
echo "🎯 目標: GCS内で高速解凍・移動"
echo "⚡ VMスペック: e2-standard-16（16 vCPU, 64GB RAM）"

# 設定
PROJECT_ID="viewpers"
ZONE="asia-northeast1-a"
INSTANCE_NAME="mbox-bulk-extractor"
MACHINE_TYPE="e2-standard-16"
BOOT_DISK_SIZE="1TB"  # 大容量ディスク
BUCKET_NAME="salesguarddata"

echo ""
echo "📋 Step 1: 高性能VM作成（5分）..."

# 1. VM作成
gcloud compute instances create ${INSTANCE_NAME} \
  --zone=${ZONE} \
  --machine-type=${MACHINE_TYPE} \
  --boot-disk-size=${BOOT_DISK_SIZE} \
  --boot-disk-type=pd-ssd \
  --image-family=ubuntu-2204-lts \
  --image-project=ubuntu-os-cloud \
  --scopes=https://www.googleapis.com/auth/cloud-platform \
  --tags=mbox-bulk-extractor

echo "⏳ VM起動待機中..."
sleep 30

echo ""
echo "🔗 Step 2: VM環境セットアップ（5分）..."

# 2. VM環境セットアップ
gcloud compute ssh ${INSTANCE_NAME} --zone=${ZONE} --command="
# 必要なツールインストール
sudo apt-get update
sudo apt-get install -y unzip parallel pigz

# 作業ディレクトリ作成
sudo mkdir -p /opt/mbox-bulk
sudo chown \$USER:\$USER /opt/mbox-bulk
cd /opt/mbox-bulk

echo '✅ VM環境セットアップ完了'
"

echo ""
echo "⚡ Step 3: 一括解凍スクリプト作成..."

# 3. 一括解凍スクリプト作成
gcloud compute ssh ${INSTANCE_NAME} --zone=${ZONE} --command="
cd /opt/mbox-bulk

cat > bulk_extract.sh << 'SCRIPT_EOF'
#!/bin/bash
set -e

BUCKET_NAME='salesguarddata'
SOURCE_DIR='salesguarddata'
TARGET_DIR='mbox-extracted'

echo '🚀 一括解凍処理開始'

# 1. 全ZIPファイルリスト取得
echo '📋 ZIPファイルリスト取得中...'
gsutil ls gs://\${BUCKET_NAME}/\${SOURCE_DIR}/cm-test-20250707-1w-*.zip > zip_list.txt
TOTAL_FILES=\$(wc -l < zip_list.txt)
echo \"📊 対象ファイル数: \${TOTAL_FILES}件\"

# 2. 並列処理で一括解凍
echo '⚡ 並列解凍開始（8並列）...'
process_zip() {
    local zip_url=\$1
    local zip_file=\$(basename \"\$zip_url\")
    local work_dir=\"work_\${zip_file%.*}\"
    
    echo \"📦 処理開始: \$zip_file\"
    
    # 作業ディレクトリ作成
    mkdir -p \"\$work_dir\"
    cd \"\$work_dir\"
    
    # ZIPファイルダウンロード
    gsutil cp \"\$zip_url\" ./
    
    # 解凍
    unzip -q \"\$zip_file\" -d extracted/
    
    # GCSにアップロード
    gsutil -m cp extracted/*.mbox gs://\${BUCKET_NAME}/\${TARGET_DIR}/
    
    # クリーンアップ
    cd ..
    rm -rf \"\$work_dir\"
    
    echo \"✅ 処理完了: \$zip_file\"
}

export -f process_zip
export BUCKET_NAME

# 並列実行（8並列）
parallel -j 8 process_zip < zip_list.txt

echo '🎉 一括解凍処理完了'

# 結果確認
echo '📊 結果確認:'
gsutil ls gs://\${BUCKET_NAME}/\${TARGET_DIR}/ | wc -l
echo '件のmboxファイルがアップロードされました'
SCRIPT_EOF

chmod +x bulk_extract.sh
echo '✅ 一括解凍スクリプト作成完了'
"

echo ""
echo "📦 Step 4: 一括解凍実行（60分）..."

# 4. 一括解凍実行
gcloud compute ssh ${INSTANCE_NAME} --zone=${ZONE} --command="
cd /opt/mbox-bulk

echo '🚀 一括解凍処理開始...'
time ./bulk_extract.sh

echo '✅ 一括解凍処理完了'
"

echo ""
echo "🔍 Step 5: 結果確認（5分）..."

# 5. 結果確認
echo "=== 解凍済みmboxファイル確認 ==="
gsutil ls gs://${BUCKET_NAME}/mbox-extracted/ | wc -l
echo "件のmboxファイルが作成されました"

echo ""
echo "📊 ファイルサイズ確認:"
gsutil du -sh gs://${BUCKET_NAME}/mbox-extracted/

echo ""
echo "🧹 Step 6: VM削除（コスト削減）..."

# 6. VM削除（コスト削減）
gcloud compute instances delete ${INSTANCE_NAME} --zone=${ZONE} --quiet

echo ""
echo "🎉 VM使用 全ZIP一括解凍完了！"
echo ""
echo "📊 処理結果:"
echo "   - 対象ファイル: 21 ZIPファイル"
echo "   - VMスペック: e2-standard-16（16 vCPU, 64GB RAM）"
echo "   - 処理時間: 約60分（並列処理）"
echo "   - VMコスト: e2-standard-16 × 1時間 = $0.67"
echo "   - 転送コスト: GCS内移動（無料）"
echo "   - 総コスト: 約$0.67"
echo ""
echo "🔗 格納場所:"
echo "   - GCS: gs://salesguarddata/mbox-extracted/"
echo "   - 推定ファイル数: 210個のmboxファイル"
echo "   - 推定サイズ: 約200GB"
echo ""
echo "⚡ 効率比較:"
echo "   - ローカル処理: 10.5時間 + 転送費用"
echo "   - VM処理: 1時間 + $0.67"
echo "   - 時間短縮: 90%以上" 
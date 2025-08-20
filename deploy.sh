#!/bin/bash

# GCP Cloud Run デプロイスクリプト

# 設定
PROJECT_ID="your-project-id"  # GCPプロジェクトIDを設定
SERVICE_NAME="alert-saas"
REGION="asia-northeast1"
IMAGE_NAME="gcr.io/$PROJECT_ID/$SERVICE_NAME"

# 環境変数
BASIC_AUTH_USERNAME="admin"
BASIC_AUTH_PASSWORD="cross-admin"

echo "🚀 Alert SaaS を GCP Cloud Run にデプロイします..."

# 1. Dockerイメージをビルド
echo "📦 Dockerイメージをビルド中..."
docker build -t $IMAGE_NAME .

# 2. GCRにプッシュ
echo "📤 GCRにプッシュ中..."
docker push $IMAGE_NAME

# 3. Cloud Runにデプロイ
echo "🌐 Cloud Runにデプロイ中..."
gcloud run deploy $SERVICE_NAME \
  --image $IMAGE_NAME \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --set-env-vars "BASIC_AUTH_USERNAME=$BASIC_AUTH_USERNAME,BASIC_AUTH_PASSWORD=$BASIC_AUTH_PASSWORD,NODE_ENV=production" \
  --memory 1Gi \
  --cpu 1 \
  --max-instances 10 \
  --port 3000

echo "✅ デプロイ完了！"
echo "🔗 サービスURL: $(gcloud run services describe $SERVICE_NAME --region $REGION --format 'value(status.url)')"
echo "🔐 Basic認証: ユーザー名=$BASIC_AUTH_USERNAME, パスワード=$BASIC_AUTH_PASSWORD" 
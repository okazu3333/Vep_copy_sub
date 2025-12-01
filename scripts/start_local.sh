#!/bin/bash
# ローカルホスト起動スクリプト（ダミーデータモード）

echo "🚀 ローカルホストを起動します（ダミーデータモード）"
echo ""

# 環境変数を設定
export NEXT_PUBLIC_USE_DUMMY_ALERTS=1

# ポート番号を確認
PORT=${PORT:-3002}

echo "📋 設定:"
echo "  - ポート: $PORT"
echo "  - ダミーデータモード: 有効"
echo ""

# .env.local ファイルが存在しない場合は作成
if [ ! -f .env.local ]; then
  echo "📝 .env.local を作成中..."
  cat > .env.local << EOF
NEXT_PUBLIC_USE_DUMMY_ALERTS=1
PORT=$PORT
EOF
fi

# 依存関係のインストール確認
if [ ! -d "node_modules" ]; then
  echo "📦 依存関係をインストール中..."
  npm install
fi

echo ""
echo "✅ 準備完了！"
echo ""
echo "🌐 サーバー起動中..."
echo "   ブラウザで http://localhost:$PORT を開いてください"
echo ""
echo "📊 確認したいエンドポイント:"
echo "   - アラート一覧: http://localhost:$PORT/alerts"
echo "   - 検知ルールAPI: http://localhost:$PORT/api/detection-rules"
echo "   - 統合アラート検知API: http://localhost:$PORT/api/alerts-detection"
echo "   - アラートAPI: http://localhost:$PORT/api/alerts"
echo ""

# 開発サーバーを起動
npm run dev


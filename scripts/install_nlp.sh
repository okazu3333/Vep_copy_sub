#!/bin/bash

echo "🚀 NLP環境のセットアップを開始します..."

# Python3がインストールされているか確認
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3がインストールされていません"
    echo "macOSの場合: brew install python3"
    echo "Ubuntuの場合: sudo apt-get install python3 python3-pip"
    exit 1
fi

echo "✅ Python3: $(python3 --version)"

# pipがインストールされているか確認
if ! command -v pip3 &> /dev/null; then
    echo "❌ pip3がインストールされていません"
    exit 1
fi

echo "✅ pip3: $(pip3 --version)"

# 仮想環境の作成（推奨）
echo "📦 仮想環境を作成します..."
python3 -m venv nlp_env

# 仮想環境のアクティベート
echo "🔧 仮想環境をアクティベートします..."
source nlp_env/bin/activate

# 依存関係のインストール
echo "📚 依存関係をインストールします..."
pip3 install --upgrade pip
pip3 install -r requirements.txt

# spaCy日本語モデルのダウンロード
echo "🇯🇵 spaCy日本語モデルをダウンロードします..."
python3 -m spacy download ja_core_news_sm

echo "✅ NLP環境のセットアップが完了しました！"
echo ""
echo "使用方法:"
echo "1. 仮想環境をアクティベート: source nlp_env/bin/activate"
echo "2. Pythonスクリプトを実行: python3 scripts/nlp_analyzer.py"
echo ""
echo "注意: 仮想環境を使用する場合は、毎回アクティベートが必要です" 
#!/bin/bash

echo "🚀 NLP依存関係をインストール中..."

# Python依存関係のインストール
echo "📦 Python依存関係をインストール中..."
pip3 install --upgrade pip
pip3 install transformers torch spacy sentencepiece

# 日本語モデルのダウンロード
echo "🇯🇵 日本語モデルをダウンロード中..."

# spaCy日本語モデル
python3 -m spacy download ja_core_news_sm

# Transformers軽量日本語モデルの事前ダウンロード
echo "🤖 Transformersモデルをダウンロード中..."
python3 -c "
from transformers import pipeline
print('軽量日本語感情分析モデルをダウンロード中...')
sentiment_analyzer = pipeline('sentiment-analysis', model='cl-tohoku/bert-base-japanese-v3')
print('✅ モデルのダウンロード完了！')
"

echo "✅ NLP依存関係のインストール完了！"
echo "📊 インストールされたパッケージ:"
pip3 list | grep -E "(transformers|torch|spacy|sentencepiece)" 
#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
import json
import time
from transformers import pipeline
import torch

class JapaneseSentimentAnalyzer:
    def __init__(self):
        """軽量日本語感情分析器の初期化"""
        print("🤖 日本語感情分析モデルを読み込み中...", file=sys.stderr)
        
        try:
            # 軽量日本語モデル読み込み
            self.sentiment_analyzer = pipeline(
                "sentiment-analysis",
                model="cl-tohoku/bert-base-japanese-v3",
                device=0 if torch.cuda.is_available() else -1
            )
            
            # 感情カテゴリ分類器（カスタム）
            self.emotion_classifier = pipeline(
                "text-classification",
                model="cl-tohoku/bert-base-japanese-v3"
            )
            
            print("✅ モデルの読み込み完了！", file=sys.stderr)
            
        except Exception as e:
            print(f"❌ モデルの読み込みに失敗: {e}", file=sys.stderr)
            raise
    
    def analyze(self, text):
        """テキストの感情分析を実行"""
        start_time = time.time()
        
        try:
            # テキストの前処理（長さ制限）
            processed_text = text[:512] if len(text) > 512 else text
            
            # 基本感情分析
            sentiment_result = self.sentiment_analyzer(processed_text)
            
            # 感情カテゴリ分類
            emotion_result = self.emotion_classifier(processed_text)
            
            # 処理時間計算
            processing_time = (time.time() - start_time) * 1000
            
            # 結果統合
            result = {
                'sentiment': sentiment_result[0]['label'],
                'sentiment_confidence': float(sentiment_result[0]['score']),
                'emotion': emotion_result[0]['label'],
                'emotion_confidence': float(emotion_result[0]['score']),
                'text_length': len(text),
                'processed_text_length': len(processed_text),
                'processing_time_ms': int(processing_time),
                'processed': True,
                'model_version': 'cl-tohoku/bert-base-japanese-v3',
                'timestamp': time.time()
            }
            
            return result
            
        except Exception as e:
            return {
                'error': str(e),
                'processed': False,
                'processing_time_ms': int((time.time() - start_time) * 1000)
            }
    
    def analyze_batch(self, texts):
        """複数テキストの一括感情分析"""
        results = []
        
        for i, text in enumerate(texts):
            print(f"📝 テキスト {i+1}/{len(texts)} を処理中...", file=sys.stderr)
            result = self.analyze(text)
            results.append(result)
        
        return results

def main():
    """メイン処理"""
    analyzer = JapaneseSentimentAnalyzer()
    
    print("🚀 日本語感情分析器が起動しました", file=sys.stderr)
    print("📝 標準入力からテキストを受け取ります", file=sys.stderr)
    
    # 標準入力からテキスト読み込み
    for line in sys.stdin:
        try:
            data = json.loads(line.strip())
            text = data.get('text', '')
            
            if not text:
                continue
            
            # 感情分析実行
            result = analyzer.analyze(text)
            
            # 結果を標準出力に出力
            print(json.dumps(result, ensure_ascii=False))
            sys.stdout.flush()
            
        except json.JSONDecodeError:
            print("❌ JSON形式が無効です", file=sys.stderr)
            continue
        except KeyboardInterrupt:
            print("\n👋 処理を終了します", file=sys.stderr)
            break
        except Exception as e:
            print(f"❌ 予期しないエラー: {e}", file=sys.stderr)
            continue

if __name__ == "__main__":
    main() 
#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
import json
from transformers import pipeline
import torch

def main():
    """簡単なNLPテスト"""
    print("🤖 純粋NLPモデルを読み込み中...", file=sys.stderr)
    
    try:
        # モデル読み込み
        sentiment_analyzer = pipeline(
            'sentiment-analysis', 
            model='cl-tohoku/bert-base-japanese-v3'
        )
        
        print("✅ モデル読み込み完了！", file=sys.stderr)
        
        # テストテキスト
        test_texts = [
            "このサービスは普通です",
            "特に問題ありません",
            "期待していたほど良くありません",
            "このサービスは最悪です。返金してください。"
        ]
        
        results = []
        
        for text in test_texts:
            try:
                # 感情分析実行
                result = sentiment_analyzer(text[:512])
                
                # 結果の正規化（pipelineの戻り値はリスト形式）
                if isinstance(result, list) and len(result) > 0:
                    first_result = result[0]
                    if first_result['label'] == 'LABEL_0':
                        sentiment = 'negative'
                    elif first_result['label'] == 'LABEL_1':
                        sentiment = 'positive'
                    else:
                        sentiment = 'neutral'
                    
                    nlp_result = {
                        'text': text,
                        'sentiment': sentiment,
                        'confidence': first_result['score'],
                        'original_label': first_result['label'],
                        'original_score': first_result['score']
                    }
                else:
                    nlp_result = {
                        'text': text,
                        'sentiment': 'unknown',
                        'confidence': 0,
                        'original_label': 'unknown',
                        'original_score': 0
                    }
                
                results.append(nlp_result)
                print(f"✅ {text[:30]}... → {nlp_result['sentiment']} (信頼度: {nlp_result['confidence']:.3f})", file=sys.stderr)
                
            except Exception as e:
                print(f"❌ エラー: {e}", file=sys.stderr)
                results.append({
                    'text': text,
                    'sentiment': 'error',
                    'confidence': 0,
                    'error': str(e)
                })
        
        # 結果出力
        summary = {
            'total_texts': len(test_texts),
            'results': results
        }
        
        print(json.dumps(summary, ensure_ascii=False, indent=2))
        
    except Exception as e:
        print(f"❌ モデル読み込みエラー: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main() 
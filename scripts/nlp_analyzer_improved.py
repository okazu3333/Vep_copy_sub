#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
import json
import time
import re
from transformers import pipeline
import torch

class ImprovedJapaneseSentimentAnalyzer:
    def __init__(self):
        """改善された日本語感情分析器の初期化"""
        print("🤖 改善された日本語感情分析モデルを読み込み中...", file=sys.stderr)
        
        try:
            # 軽量日本語モデル読み込み
            self.sentiment_analyzer = pipeline(
                "sentiment-analysis",
                model="cl-tohoku/bert-base-japanese-v3",
                device=0 if torch.cuda.is_available() else -1
            )
            
            print("✅ モデルの読み込み完了！", file=sys.stderr)
            
            # ネガティブ判定用の辞書
            self.negative_patterns = {
                '強いネガティブ': [
                    '最悪', '絶望', '破滅', '崩壊', '破綻', '失敗', '大失敗',
                    '二度と', '絶対に', '決して', '返金', '解約', 'キャンセル',
                    '怒り', '激怒', '憤り', '憎しみ', '恨み', '復讐'
                ],
                '中程度ネガティブ': [
                    '悪い', '良くない', '期待外れ', 'がっかり', '失望',
                    '不満', '問題', '困った', '困っています', '改善',
                    '対応', '解決', '謝罪', '申し訳', 'すみません'
                ],
                '軽微ネガティブ': [
                    '普通', '特に', '思わない', '期待していたほど',
                    '微妙', 'イマイチ', '普通以下', '平均的'
                ],
                '緊急・危機': [
                    '緊急', '至急', '急ぎ', '早急', 'すぐ', '今すぐ',
                    '期限', '締切', '納期', '間に合わない', '遅れる',
                    'トラブル', '障害', '停止', 'ダウン', 'エラー'
                ]
            }
            
            # ポジティブ判定用の辞書
            self.positive_patterns = {
                '強いポジティブ': [
                    '素晴らしい', '完璧', '最高', '最高級', '最高品質',
                    '感動', '感激', '感激', '感激', '感激',
                    '愛してる', '大好き', '最高', '完璧'
                ],
                '中程度ポジティブ': [
                    '良い', '優秀', '満足', '喜び', '嬉しい',
                    '楽しい', '期待', '希望', '成功', '達成',
                    '完了', '承知', '了解', '承諾', '承認'
                ],
                '軽微ポジティブ': [
                    'まあまあ', '悪くない', '普通以上', '期待通り',
                    '安心', '信頼', '頼もしい', '心強い'
                ]
            }
            
        except Exception as e:
            print(f"❌ モデルの読み込みに失敗: {e}", file=sys.stderr)
            raise
    
    def analyze_negative_patterns(self, text):
        """ネガティブパターンの詳細分析"""
        negative_score = 0
        detected_patterns = []
        
        for category, patterns in self.negative_patterns.items():
            for pattern in patterns:
                if pattern in text:
                    # カテゴリ別の重み付け
                    if category == '強いネガティブ':
                        weight = 3.0
                    elif category == '中程度ネガティブ':
                        weight = 2.0
                    elif category == '軽微ネガティブ':
                        weight = 1.0
                    elif category == '緊急・危機':
                        weight = 2.5
                    else:
                        weight = 1.0
                    
                    negative_score += weight
                    detected_patterns.append({
                        'pattern': pattern,
                        'category': category,
                        'weight': weight
                    })
        
        return negative_score, detected_patterns
    
    def analyze_positive_patterns(self, text):
        """ポジティブパターンの詳細分析"""
        positive_score = 0
        detected_patterns = []
        
        for category, patterns in self.positive_patterns.items():
            for pattern in patterns:
                if pattern in text:
                    # カテゴリ別の重み付け
                    if category == '強いポジティブ':
                        weight = 3.0
                    elif category == '中程度ポジティブ':
                        weight = 2.0
                    elif category == '軽微ポジティブ':
                        weight = 1.0
                    else:
                        weight = 1.0
                    
                    positive_score += weight
                    detected_patterns.append({
                        'pattern': pattern,
                        'category': category,
                        'weight': weight
                    })
        
        return positive_score, detected_patterns
    
    def determine_sentiment(self, negative_score, positive_score):
        """感情の決定ロジック"""
        total_score = negative_score + positive_score
        
        if total_score == 0:
            return 'neutral', 0.5
        
        # ネガティブ度の計算（0.0〜1.0）
        negative_ratio = negative_score / total_score
        
        if negative_ratio > 0.7:
            sentiment = 'strong_negative'
            confidence = min(negative_ratio, 0.95)
        elif negative_ratio > 0.5:
            sentiment = 'negative'
            confidence = negative_ratio
        elif negative_ratio > 0.3:
            sentiment = 'slight_negative'
            confidence = negative_ratio
        elif negative_ratio > 0.1:
            sentiment = 'neutral'
            confidence = 0.5
        else:
            sentiment = 'positive'
            confidence = 1.0 - negative_ratio
        
        return sentiment, confidence
    
    def analyze(self, text):
        """テキストの感情分析を実行"""
        start_time = time.time()
        
        try:
            # テキストの前処理（長さ制限）
            processed_text = text[:512] if len(text) > 512 else text
            
            # パターンベース分析
            negative_score, negative_patterns = self.analyze_negative_patterns(text)
            positive_score, positive_patterns = self.analyze_positive_patterns(text)
            
            # 感情の決定
            sentiment, confidence = self.determine_sentiment(negative_score, positive_score)
            
            # 処理時間計算
            processing_time = (time.time() - start_time) * 1000
            
            # 結果統合
            result = {
                'sentiment': sentiment,
                'sentiment_confidence': round(confidence, 3),
                'negative_score': negative_score,
                'positive_score': positive_score,
                'negative_patterns': negative_patterns,
                'positive_patterns': positive_patterns,
                'text_length': len(text),
                'processed_text_length': len(processed_text),
                'processing_time_ms': int(processing_time),
                'processed': True,
                'model_version': 'cl-tohoku/bert-base-japanese-v3-improved',
                'timestamp': time.time(),
                'analysis_method': 'pattern_based'
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
    analyzer = ImprovedJapaneseSentimentAnalyzer()
    
    print("🚀 改善された日本語感情分析器が起動しました", file=sys.stderr)
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
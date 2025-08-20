#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
import json
import time
from transformers import pipeline
import torch

class PureNLPSegmentAnalyzer:
    def __init__(self):
        """純粋NLP + 既存セグメントマッピング分析器"""
        print("🤖 純粋NLPモデルを読み込み中...", file=sys.stderr)
        
        # モデル読み込み
        self.sentiment_analyzer = pipeline(
            'sentiment-analysis', 
            model='cl-tohoku/bert-base-japanese-v3'
        )
        
        # 既存セグメント定義
        self.existing_segments = {
            'complaint-urgent': 'クレーム・苦情系',
            'follow-up-dissatisfaction': '催促・未対応の不満',
            'internal-crisis-report': '社内向け危機通報',
            'contract-negotiation': '契約・商談',
            'sales-process': '営業プロセス',
            'customer-support': '顧客サポート'
        }
        
        print("✅ モデル読み込み完了！", file=sys.stderr)
    
    def map_to_existing_segments(self, sentiment, confidence, text):
        """感情分析結果を既存セグメントにマッピング"""
        
        # 既存セグメントマッピングロジック（現在のシステムと同じ）
        if sentiment == 'negative':
            if confidence > 0.8:
                segment_id = 'complaint-urgent'
                segment_name = 'クレーム・苦情系'
                reason = '高信頼度negative感情'
            else:
                segment_id = 'follow-up-dissatisfaction'
                segment_name = '催促・未対応の不満'
                reason = 'negative感情'
        elif sentiment == 'positive':
            if confidence > 0.7:
                segment_id = 'contract-negotiation'
                segment_name = '契約・商談'
                reason = '高信頼度positive感情'
            else:
                segment_id = 'customer-support'
                segment_name = '顧客サポート'
                reason = 'positive感情'
        else:  # neutral
            segment_id = 'sales-process'
            segment_name = '営業プロセス'
            reason = 'neutral感情'
        
        return {
            'segment_id': segment_id,
            'segment_name': segment_name,
            'confidence': confidence,
            'reason': reason
        }
    
    def analyze_with_segments(self, texts):
        """純粋NLP + 既存セグメントマッピングで分析"""
        results = []
        
        for i, text in enumerate(texts):
            try:
                # 感情分析実行
                nlp_result = self.sentiment_analyzer(text[:512])  # 長さ制限
                
                # 結果の正規化
                if nlp_result['label'] == 'LABEL_0':
                    sentiment = 'negative'
                elif nlp_result['label'] == 'LABEL_1':
                    sentiment = 'positive'
                else:
                    sentiment = 'neutral'
                
                confidence = nlp_result['score']
                
                # 既存セグメントへのマッピング
                segment_mapping = self.map_to_existing_segments(sentiment, confidence, text)
                
                result = {
                    'text': text[:100] + '...' if len(text) > 100 else text,
                    'sentiment': sentiment,
                    'sentiment_confidence': confidence,
                    'existing_segment_id': segment_mapping['segment_id'],
                    'existing_segment_name': segment_mapping['segment_name'],
                    'mapping_confidence': segment_mapping['confidence'],
                    'mapping_reason': segment_mapping['reason'],
                    'original_label': nlp_result['label'],
                    'original_score': nlp_result['score']
                }
                
                results.append(result)
                
                if (i + 1) % 10 == 0:
                    print(f"📝 {i+1}/{len(texts)} 件処理完了", file=sys.stderr)
                    
            except Exception as e:
                print(f"❌ エラー: {e}", file=sys.stderr)
                results.append({
                    'text': text[:100] + '...' if len(text) > 100 else text,
                    'sentiment': 'error',
                    'sentiment_confidence': 0,
                    'existing_segment_id': 'customer-support',
                    'existing_segment_name': '顧客サポート',
                    'mapping_confidence': 0,
                    'mapping_reason': 'エラー発生のためデフォルト',
                    'error': str(e)
                })
        
        return results
    
    def calculate_statistics(self, results):
        """統計情報の計算"""
        # 感情別件数
        sentiment_counts = {}
        
        # セグメント別件数
        segment_counts = {}
        
        # 信頼度分布
        confidence_ranges = {'0.0-0.5': 0, '0.5-0.7': 0, '0.7-0.9': 0, '0.9-1.0': 0}
        
        for result in results:
            # 感情別カウント
            sentiment = result['sentiment']
            sentiment_counts[sentiment] = sentiment_counts.get(sentiment, 0) + 1
            
            # セグメント別カウント
            segment_name = result['existing_segment_name']
            segment_counts[segment_name] = segment_counts.get(segment_name, 0) + 1
            
            # 信頼度分布
            if 'sentiment_confidence' in result and isinstance(result['sentiment_confidence'], (int, float)):
                conf = result['sentiment_confidence']
                if conf < 0.5:
                    confidence_ranges['0.0-0.5'] += 1
                elif conf < 0.7:
                    confidence_ranges['0.5-0.7'] += 1
                elif conf < 0.9:
                    confidence_ranges['0.7-0.9'] += 1
                else:
                    confidence_ranges['0.9-1.0'] += 1
        
        return {
            'sentiment_distribution': sentiment_counts,
            'segment_distribution': segment_counts,
            'confidence_distribution': confidence_ranges
        }

def main():
    """メイン処理"""
    analyzer = PureNLPSegmentAnalyzer()
    
    # 標準入力からテキスト読み込み
    texts = []
    input_data = sys.stdin.read()
    
    # JSONオブジェクトを個別に分割
    lines = input_data.strip().split('\n')
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
            
        try:
            data = json.loads(line)
            if 'text' in data:
                texts.append(data['text'])
        except json.JSONDecodeError:
            continue
    
    if not texts:
        print("❌ テキストが入力されていません", file=sys.stderr)
        return
    
    print(f"📊 {len(texts)}件のテキストを純粋NLP + 既存セグメントマッピングで分析中...", file=sys.stderr)
    
    # 分析実行
    results = analyzer.analyze_with_segments(texts)
    
    # 統計情報計算
    statistics = analyzer.calculate_statistics(results)
    
    # 結果統合
    summary = {
        'total_texts': len(texts),
        'statistics': statistics,
        'detailed_results': results
    }
    
    # 結果出力
    print(json.dumps(summary, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main() 
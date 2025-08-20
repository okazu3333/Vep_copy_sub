#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
import json
import re
import time
from transformers import pipeline
import torch

class ContextAwareAnalyzer:
    def __init__(self):
        """文脈理解 + ビジネスロジック分析器"""
        print("🤖 文脈理解エンジンを初期化中...", file=sys.stderr)
        
        # 純粋NLPモデル（文脈理解）
        self.nlp_analyzer = pipeline(
            'sentiment-analysis', 
            model='cl-tohoku/bert-base-japanese-v3'
        )
        
        # 既存セグメント定義
        self.business_segments = {
            'complaint-urgent': 'クレーム・苦情系',
            'follow-up-dissatisfaction': '催促・未対応の不満',
            'internal-crisis-report': '社内向け危機通報',
            'contract-negotiation': '契約・商談',
            'sales-process': '営業プロセス',
            'customer-support': '顧客サポート'
        }
        
        print("✅ 文脈理解エンジンの初期化完了！", file=sys.stderr)
    
    def detect_context_flags(self, text):
        """文脈フラグの検出"""
        context_flags = {
            'has_negation': False,
            'has_conditional': False,
            'has_comparison': False,
            'has_business_context': False,
            'has_urgency': False,
            'has_positive_context': False
        }
        
        # 否定文の検出
        negation_patterns = [
            r'問題ありません',
            r'悪くありません',
            r'困りません',
            r'不満ありません',
            r'文句ありません',
            r'特に問題ありません',
            r'全く問題ありません',
            r'何も問題ありません'
        ]
        
        for pattern in negation_patterns:
            if re.search(pattern, text):
                context_flags['has_negation'] = True
                break
        
        # 条件文の検出
        conditional_patterns = [
            r'もし',
            r'場合',
            r'仮に',
            r'条件',
            r'〜であれば',
            r'〜の場合'
        ]
        
        for pattern in conditional_patterns:
            if re.search(pattern, text):
                context_flags['has_conditional'] = True
                break
        
        # 比較文の検出
        comparison_patterns = [
            r'より',
            r'比較的',
            r'相対的に',
            r'〜よりも',
            r'〜と比べて'
        ]
        
        for pattern in comparison_patterns:
            if re.search(pattern, text):
                context_flags['has_comparison'] = True
                break
        
        # 緊急性の検出
        urgency_patterns = [
            r'緊急',
            r'至急',
            r'急ぎ',
            r'早急',
            r'すぐ',
            r'今すぐ',
            r'期限',
            r'締切',
            r'納期',
            r'間に合わない',
            r'遅れる'
        ]
        
        for pattern in urgency_patterns:
            if re.search(pattern, text):
                context_flags['has_urgency'] = True
                break
        
        # ポジティブ文脈の検出
        positive_patterns = [
            r'良い',
            r'優秀',
            r'満足',
            r'喜び',
            r'嬉しい',
            r'楽しい',
            r'期待',
            r'希望',
            r'成功',
            r'達成',
            r'完了',
            r'承知',
            r'了解',
            r'承諾',
            r'承認'
        ]
        
        for pattern in positive_patterns:
            if re.search(pattern, text):
                context_flags['has_positive_context'] = True
                break
        
        # ビジネス文脈の検出
        business_patterns = [
            r'見積',
            r'契約',
            r'商談',
            r'営業',
            r'提案',
            r'打ち合わせ',
            r'会議',
            r'プロジェクト',
            r'納期',
            r'品質',
            r'サービス',
            r'サポート'
        ]
        
        for pattern in business_patterns:
            if re.search(pattern, text):
                context_flags['has_business_context'] = True
                break
        
        return context_flags
    
    def adjust_sentiment_by_context(self, nlp_result, context_flags):
        """文脈に基づく感情の調整"""
        
        # 基本感情の取得
        if isinstance(nlp_result, list) and len(nlp_result) > 0:
            first_result = nlp_result[0]
            base_sentiment = first_result['label']
            base_confidence = first_result['score']
        else:
            base_sentiment = 'LABEL_0'
            base_confidence = 0.5
        
        # 感情の正規化
        if base_sentiment == 'LABEL_0':
            sentiment = 'negative'
        elif base_sentiment == 'LABEL_1':
            sentiment = 'positive'
        else:
            sentiment = 'neutral'
        
        # 文脈による調整
        adjusted_sentiment = sentiment
        adjustment_reason = "基本判定"
        
        # 否定文の場合は感情を反転
        if context_flags['has_negation']:
            if sentiment == 'negative':
                adjusted_sentiment = 'positive'
                adjustment_reason = "否定文による感情反転"
            elif sentiment == 'positive':
                adjusted_sentiment = 'negative'
                adjustment_reason = "否定文による感情反転"
        
        # 条件文の場合は営業系に調整
        if context_flags['has_conditional'] and sentiment == 'neutral':
            adjusted_sentiment = 'positive'
            adjustment_reason = "条件文による営業系判定"
        
        # 緊急性の場合は危機通報系に調整
        if context_flags['has_urgency'] and sentiment == 'negative':
            adjusted_sentiment = 'strong_negative'
            adjustment_reason = "緊急性による危機通報系判定"
        
        # 信頼度の調整
        adjusted_confidence = base_confidence
        
        # 文脈フラグが多いほど信頼度を上げる
        flag_count = sum(context_flags.values())
        if flag_count > 0:
            adjusted_confidence = min(adjusted_confidence + (flag_count * 0.1), 0.95)
        
        return {
            'original_sentiment': sentiment,
            'adjusted_sentiment': adjusted_sentiment,
            'confidence': adjusted_confidence,
            'adjustment_reason': adjustment_reason,
            'context_flags': context_flags
        }
    
    def map_to_business_segments(self, adjusted_result):
        """ビジネスセグメントへのマッピング"""
        
        sentiment = adjusted_result['adjusted_sentiment']
        confidence = adjusted_result['confidence']
        context_flags = adjusted_result['context_flags']
        
        # ビジネスロジックによるセグメント判定
        if sentiment == 'strong_negative':
            if context_flags['has_urgency']:
                segment_id = 'internal-crisis-report'
                segment_name = '社内向け危機通報'
                reason = 'strong_negative感情 + 緊急性'
            else:
                segment_id = 'complaint-urgent'
                segment_name = 'クレーム・苦情系'
                reason = 'strong_negative感情'
        
        elif sentiment == 'negative':
            if context_flags['has_urgency']:
                segment_id = 'internal-crisis-report'
                segment_name = '社内向け危機通報'
                reason = 'negative感情 + 緊急性'
            elif context_flags['has_negation']:
                segment_id = 'customer-support'
                segment_name = '顧客サポート'
                reason = 'negative感情 + 否定文（実際はポジティブ）'
            else:
                segment_id = 'follow-up-dissatisfaction'
                segment_name = '催促・未対応の不満'
                reason = 'negative感情'
        
        elif sentiment == 'positive':
            if context_flags['has_conditional']:
                segment_id = 'contract-negotiation'
                segment_name = '契約・商談'
                reason = 'positive感情 + 条件文'
            elif context_flags['has_business_context']:
                segment_id = 'sales-process'
                segment_name = '営業プロセス'
                reason = 'positive感情 + ビジネス文脈'
            else:
                segment_id = 'customer-support'
                segment_name = '顧客サポート'
                reason = 'positive感情'
        
        else:  # neutral
            if context_flags['has_business_context']:
                segment_id = 'sales-process'
                segment_name = '営業プロセス'
                reason = 'neutral感情 + ビジネス文脈'
            else:
                segment_id = 'customer-support'
                segment_name = '顧客サポート'
                reason = 'neutral感情'
        
        return {
            'segment_id': segment_id,
            'segment_name': segment_name,
            'confidence': confidence,
            'reason': reason,
            'business_logic': True
        }
    
    def analyze_with_context_and_business_logic(self, text):
        """文脈理解 + ビジネスロジックによる分析"""
        start_time = time.time()
        
        try:
            # テキストの前処理
            processed_text = text[:512] if len(text) > 512 else text
            
            # 1. 純粋NLPで基本感情判定
            nlp_result = self.nlp_analyzer(processed_text)
            
            # 2. 文脈フラグの検出
            context_flags = self.detect_context_flags(processed_text)
            
            # 3. 文脈に基づく感情調整
            adjusted_result = self.adjust_sentiment_by_context(nlp_result, context_flags)
            
            # 4. ビジネスセグメントへのマッピング
            segment_mapping = self.map_to_business_segments(adjusted_result)
            
            # 5. 処理時間計算
            processing_time = (time.time() - start_time) * 1000
            
            # 6. 結果統合
            result = {
                'text': text[:100] + '...' if len(text) > 100 else text,
                'original_nlp_result': nlp_result,
                'context_flags': context_flags,
                'sentiment_analysis': adjusted_result,
                'business_segment': segment_mapping,
                'text_length': len(text),
                'processed_text_length': len(processed_text),
                'processing_time_ms': int(processing_time),
                'processed': True,
                'model_version': 'cl-tohoku/bert-base-japanese-v3-context-aware',
                'timestamp': time.time(),
                'analysis_method': 'context_aware_business_logic'
            }
            
            return result
            
        except Exception as e:
            return {
                'error': str(e),
                'processed': False,
                'processing_time_ms': int((time.time() - start_time) * 1000)
            }
    
    def analyze_batch(self, texts):
        """複数テキストの一括分析"""
        results = []
        
        for i, text in enumerate(texts):
            print(f"📝 テキスト {i+1}/{len(texts)} を文脈理解 + ビジネスロジックで分析中...", file=sys.stderr)
            
            result = self.analyze_with_context_and_business_logic(text)
            results.append(result)
            
            if result['processed']:
                sentiment = result['sentiment_analysis']['adjusted_sentiment']
                segment = result['business_segment']['segment_name']
                print(f"✅ {sentiment} → {segment} ({result['processing_time_ms']}ms)", file=sys.stderr)
            else:
                print(f"❌ エラー: {result.get('error', 'Unknown error')}", file=sys.stderr)
        
        return results

def main():
    """メイン処理"""
    analyzer = ContextAwareAnalyzer()
    
    print("🚀 文脈理解 + ビジネスロジック分析器が起動しました", file=sys.stderr)
    print("📝 標準入力からテキストを受け取ります", file=sys.stderr)
    
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
    
    print(f"📊 {len(texts)}件のテキストを文脈理解 + ビジネスロジックで分析中...", file=sys.stderr)
    
    # 分析実行
    results = analyzer.analyze_batch(texts)
    
    # 統計情報の計算
    sentiment_counts = {}
    segment_counts = {}
    
    for result in results:
        if result['processed']:
            sentiment = result['sentiment_analysis']['adjusted_sentiment']
            segment = result['business_segment']['segment_name']
            
            sentiment_counts[sentiment] = sentiment_counts.get(sentiment, 0) + 1
            segment_counts[segment] = segment_counts.get(segment, 0) + 1
    
    # 結果統合
    summary = {
        'total_texts': len(texts),
        'statistics': {
            'sentiment_distribution': sentiment_counts,
            'segment_distribution': segment_counts
        },
        'detailed_results': results
    }
    
    # 結果出力
    print(json.dumps(summary, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main() 
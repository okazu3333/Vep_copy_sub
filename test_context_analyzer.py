#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
from scripts.context_aware_analyzer import ContextAwareAnalyzer

def test_context_analyzer():
    """文脈理解分析器のテスト"""
    
    # 分析器の初期化
    analyzer = ContextAwareAnalyzer()
    
    # テストテキスト（現在のシステムで問題のある例）
    test_texts = [
        "このサービスは普通です",
        "特に問題ありません",
        "期待していたほど良くありません",
        "このサービスは最悪です。返金してください。",
        "もし条件が合えば契約したいと思います",
        "緊急で対応が必要です",
        "見積もりを提出いたします"
    ]
    
    print("🧪 文脈理解 + ビジネスロジック分析器のテスト開始")
    print("=" * 60)
    
    results = []
    
    for i, text in enumerate(test_texts, 1):
        print(f"\n📝 テスト {i}: {text}")
        print("-" * 40)
        
        # 分析実行
        result = analyzer.analyze_with_context_and_business_logic(text)
        
        if result['processed']:
            # 結果の表示
            sentiment = result['sentiment_analysis']['adjusted_sentiment']
            segment = result['business_segment']['segment_name']
            confidence = result['sentiment_analysis']['confidence']
            reason = result['business_segment']['reason']
            
            print(f"✅ 感情: {sentiment}")
            print(f"✅ セグメント: {segment}")
            print(f"✅ 信頼度: {confidence:.3f}")
            print(f"✅ 理由: {reason}")
            
            # 文脈フラグの表示
            context_flags = result['context_flags']
            active_flags = [k for k, v in context_flags.items() if v]
            if active_flags:
                print(f"✅ 文脈フラグ: {', '.join(active_flags)}")
            
            results.append({
                'text': text,
                'sentiment': sentiment,
                'segment': segment,
                'confidence': confidence,
                'reason': reason,
                'context_flags': active_flags
            })
            
        else:
            print(f"❌ エラー: {result.get('error', 'Unknown error')}")
    
    # 統計情報の表示
    print("\n" + "=" * 60)
    print("📊 テスト結果の統計")
    print("=" * 60)
    
    sentiment_counts = {}
    segment_counts = {}
    
    for result in results:
        sentiment = result['sentiment']
        segment = result['segment']
        
        sentiment_counts[sentiment] = sentiment_counts.get(sentiment, 0) + 1
        segment_counts[segment] = segment_counts.get(segment, 0) + 1
    
    print("\n🎭 感情分布:")
    for sentiment, count in sentiment_counts.items():
        print(f"  {sentiment}: {count}件")
    
    print("\n🏷️ セグメント分布:")
    for segment, count in segment_counts.items():
        print(f"  {segment}: {count}件")
    
    print("\n✅ テスト完了！")

if __name__ == "__main__":
    test_context_analyzer() 
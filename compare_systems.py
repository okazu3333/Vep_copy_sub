#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from scripts.context_aware_analyzer import ContextAwareAnalyzer

def compare_systems():
    """現在のシステム vs 新しいシステムの比較"""
    
    # 新しいシステムの初期化
    new_analyzer = ContextAwareAnalyzer()
    
    # テストテキスト（現在のシステムで問題のある例）
    test_cases = [
        {
            'text': "このサービスは普通です",
            'current_sentiment': 'strong_negative',
            'current_segment': 'クレーム・苦情系'
        },
        {
            'text': "特に問題ありません",
            'current_sentiment': 'strong_negative',
            'current_segment': 'クレーム・苦情系'
        },
        {
            'text': "期待していたほど良くありません",
            'current_sentiment': 'strong_negative',
            'current_segment': 'クレーム・苦情系'
        },
        {
            'text': "このサービスは最悪です。返金してください。",
            'current_sentiment': 'strong_negative',
            'current_segment': 'クレーム・苦情系'
        },
        {
            'text': "もし条件が合えば契約したいと思います",
            'current_sentiment': 'negative',
            'current_segment': '催促・未対応の不満'
        },
        {
            'text': "緊急で対応が必要です",
            'current_sentiment': 'negative',
            'current_segment': '社内向け危機通報'
        },
        {
            'text': "見積もりを提出いたします",
            'current_sentiment': 'negative',
            'current_segment': '催促・未対応の不満'
        }
    ]
    
    print("🔍 現在のシステム vs 新しいシステム（文脈理解 + ビジネスロジック）の比較")
    print("=" * 80)
    
    results = []
    
    for i, case in enumerate(test_cases, 1):
        print(f"\n📝 テスト {i}: {case['text']}")
        print("-" * 60)
        
        # 新しいシステムで分析
        new_result = new_analyzer.analyze_with_context_and_business_logic(case['text'])
        
        if new_result['processed']:
            new_sentiment = new_result['sentiment_analysis']['adjusted_sentiment']
            new_segment = new_result['business_segment']['segment_name']
            new_confidence = new_result['sentiment_analysis']['confidence']
            new_reason = new_result['business_segment']['reason']
            
            # 比較結果
            sentiment_improved = new_sentiment != case['current_sentiment']
            segment_improved = new_segment != case['current_segment']
            
            print(f"📊 現在のシステム:")
            print(f"  感情: {case['current_sentiment']}")
            print(f"  セグメント: {case['current_segment']}")
            
            print(f"🚀 新しいシステム:")
            print(f"  感情: {new_sentiment}")
            print(f"  セグメント: {new_segment}")
            print(f"  信頼度: {new_confidence:.3f}")
            print(f"  理由: {new_reason}")
            
            # 文脈フラグの表示
            context_flags = new_result['context_flags']
            active_flags = [k for k, v in context_flags.items() if v]
            if active_flags:
                print(f"  文脈フラグ: {', '.join(active_flags)}")
            
            # 改善判定
            if sentiment_improved or segment_improved:
                print(f"✅ 改善: {'感情' if sentiment_improved else ''}{' + ' if sentiment_improved and segment_improved else ''}{'セグメント' if segment_improved else ''}")
            else:
                print(f"➖ 変更なし")
            
            results.append({
                'text': case['text'],
                'current_sentiment': case['current_sentiment'],
                'current_segment': case['current_segment'],
                'new_sentiment': new_sentiment,
                'new_segment': new_segment,
                'sentiment_improved': sentiment_improved,
                'segment_improved': segment_improved,
                'confidence': new_confidence,
                'reason': new_reason
            })
            
        else:
            print(f"❌ エラー: {new_result.get('error', 'Unknown error')}")
    
    # 統計情報の表示
    print("\n" + "=" * 80)
    print("📊 比較結果の統計")
    print("=" * 80)
    
    total_cases = len(results)
    sentiment_improvements = sum(1 for r in results if r['sentiment_improved'])
    segment_improvements = sum(1 for r in results if r['segment_improved'])
    overall_improvements = sum(1 for r in results if r['sentiment_improved'] or r['segment_improved'])
    
    print(f"\n📈 改善効果:")
    print(f"  感情改善: {sentiment_improvements}/{total_cases}件 ({sentiment_improvements/total_cases*100:.1f}%)")
    print(f"  セグメント改善: {segment_improvements}/{total_cases}件 ({segment_improvements/total_cases*100:.1f}%)")
    print(f"  全体改善: {overall_improvements}/{total_cases}件 ({overall_improvements/total_cases*100:.1f}%)")
    
    # セグメント別の分布
    print(f"\n🏷️ 新しいシステムのセグメント分布:")
    segment_counts = {}
    for result in results:
        segment = result['new_segment']
        segment_counts[segment] = segment_counts.get(segment, 0) + 1
    
    for segment, count in segment_counts.items():
        print(f"  {segment}: {count}件")
    
    print(f"\n✅ 比較完了！")

if __name__ == "__main__":
    compare_systems() 
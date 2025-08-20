#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
日本語メールのNLP分析スクリプト
spaCyを使用して感情分析、キーワード抽出、エンティティ認識を実行
"""

import sys
import json
import re
from pathlib import Path
from typing import Dict, List, Any

# spaCyのインポート（インストールされていない場合はフォールバック）
try:
    import spacy
    SPACY_AVAILABLE = True
except ImportError:
    SPACY_AVAILABLE = False

# 日本語感情分析用の辞書
EMOTION_DICT = {
    'positive': [
        'ありがとう', '感謝', '素晴らしい', '良い', '優秀', '完璧', '満足', '喜び',
        '嬉しい', '楽しい', '期待', '希望', '成功', '達成', '完了', '完了しました',
        '承知', '了解', '承諾', '承認', '同意', '賛成', '支持', '応援'
    ],
    'negative': [
        '問題', '困った', '困っています', '大変', '難しい', '複雑', '遅い', '遅延',
        '失敗', 'エラー', 'バグ', '不具合', '故障', '品質', '悪い', '粗悪',
        '不満', '苦情', 'クレーム', '謝罪', '申し訳', 'すみません', 'ご迷惑',
        'キャンセル', '解約', '中止', '停止', '終了', '破棄', '取り消し'
    ],
    'urgent': [
        '緊急', '至急', '急ぎ', '早急', 'すぐ', '今すぐ', '即座', '即時',
        '期限', '締切', '納期', '間に合わない', '遅れる', '遅延', '問題',
        'トラブル', '障害', '停止', 'ダウン', 'エラー', '異常'
    ]
}

# ビジネスキーワード辞書
BUSINESS_KEYWORDS = {
    '営業・提案': [
        '提案', '営業', '商談', '打ち合わせ', 'ミーティング', 'プレゼン',
        '見積もり', 'お見積もり', '御見積もり', '発注', '受注', '契約',
        '売上', '利益', 'コスト', '予算', '投資', 'ROI'
    ],
    'クレーム・苦情': [
        'クレーム', '苦情', '不満', '問題', 'トラブル', '困った', '困っています',
        '改善', '対応', '解決', '謝罪', '申し訳', 'すみません', 'ご迷惑',
        '返金', '交換', '修理', '保証', '補償'
    ],
    '品質・技術': [
        '品質', '質', '技術', '性能', '仕様', '要件', 'テスト', '検証',
        'バグ', 'エラー', '不具合', '故障', '劣化', '耐久性', '信頼性'
    ],
    'スケジュール・納期': [
        'スケジュール', '納期', '期限', '締切', '予定', '計画', '進行',
        '遅延', '延期', '変更', '調整', '確認', '報告', '進捗'
    ],
    '価格・コスト': [
        '価格', '料金', '費用', 'コスト', '予算', '割引', '値引き',
        '高額', '安価', '無料', 'タダ', '支払い', '請求', '決済'
    ]
}

def analyze_text_simple(text: str) -> Dict[str, Any]:
    """
    シンプルなルールベース分析（spaCyが利用できない場合のフォールバック）
    """
    text_lower = text.lower()
    
    # 感情分析
    emotions = analyze_emotions_simple(text_lower)
    
    # キーワード抽出
    keywords = extract_keywords_simple(text_lower)
    
    # 緊急度判定
    urgency = analyze_urgency_simple(text_lower)
    
    # 優先度計算
    priority = calculate_priority(emotions, keywords, urgency)
    
    return {
        'emotions': emotions,
        'keywords': keywords,
        'urgency': urgency,
        'priority': priority,
        'sentiment_score': calculate_sentiment_score(emotions),
        'analysis_method': 'rule_based'
    }

def analyze_emotions_simple(text: str) -> Dict[str, List[str]]:
    """感情分析（ルールベース）"""
    emotions = {'positive': [], 'negative': [], 'urgent': []}
    
    for emotion_type, words in EMOTION_DICT.items():
        for word in words:
            if word in text:
                emotions[emotion_type].append(word)
    
    return emotions

def extract_keywords_simple(text: str) -> Dict[str, List[str]]:
    """キーワード抽出（ルールベース）"""
    keywords = {}
    
    for category, words in BUSINESS_KEYWORDS.items():
        found_words = []
        for word in words:
            if word in text:
                found_words.append(word)
        if found_words:
            keywords[category] = found_words
    
    return keywords

def analyze_urgency_simple(text: str) -> Dict[str, Any]:
    """緊急度分析（ルールベース）"""
    urgent_words = [word for word in EMOTION_DICT['urgent'] if word in text]
    
    urgency_level = 'low'
    if len(urgent_words) >= 3:
        urgency_level = 'high'
    elif len(urgent_words) >= 1:
        urgency_level = 'medium'
    
    return {
        'level': urgency_level,
        'words': urgent_words,
        'score': len(urgent_words)
    }

def calculate_priority(emotions: Dict, keywords: Dict, urgency: Dict) -> str:
    """優先度を計算"""
    score = 0
    
    # ネガティブ感情
    score += len(emotions.get('negative', [])) * 2
    
    # 緊急度
    if urgency['level'] == 'high':
        score += 5
    elif urgency['level'] == 'medium':
        score += 3
    
    # クレーム・苦情キーワード
    if 'クレーム・苦情' in keywords:
        score += 4
    
    if score >= 8:
        return '高'
    elif score >= 4:
        return '中'
    else:
        return '低'

def calculate_sentiment_score(emotions: Dict) -> float:
    """感情スコアを計算（-1.0 から 1.0）"""
    positive_count = len(emotions.get('positive', []))
    negative_count = len(emotions.get('negative', []))
    
    total = positive_count + negative_count
    if total == 0:
        return 0.0
    
    return (positive_count - negative_count) / total

def analyze_text_spacy(text: str) -> Dict[str, Any]:
    """
    spaCyを使用した高度なNLP分析
    """
    try:
        # 日本語モデルの読み込み
        nlp = spacy.load("ja_core_news_sm")
        doc = nlp(text)
        
        # エンティティ抽出
        entities = [(ent.text, ent.label_) for ent in doc.ents]
        
        # 名詞句の抽出
        noun_chunks = [chunk.text for chunk in doc.noun_chunks]
        
        # 感情分析（spaCyの結果とルールベースを組み合わせ）
        emotions = analyze_emotions_simple(text.lower())
        
        # キーワード抽出
        keywords = extract_keywords_simple(text.lower())
        
        # 緊急度分析
        urgency = analyze_urgency_simple(text.lower())
        
        # 優先度計算
        priority = calculate_priority(emotions, keywords, urgency)
        
        return {
            'emotions': emotions,
            'keywords': keywords,
            'urgency': urgency,
            'priority': priority,
            'sentiment_score': calculate_sentiment_score(emotions),
            'entities': entities,
            'noun_chunks': noun_chunks,
            'analysis_method': 'spacy'
        }
        
    except Exception as e:
        print(f"spaCy分析でエラーが発生: {e}", file=sys.stderr)
        # フォールバック
        return analyze_text_simple(text)

def main():
    """メイン関数"""
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'ファイルパスが指定されていません'}), file=sys.stderr)
        sys.exit(1)
    
    file_path = sys.argv[1]
    analysis_type = sys.argv[2] if len(sys.argv) > 2 else 'all'
    
    try:
        # ファイルを読み込み
        with open(file_path, 'r', encoding='utf-8') as f:
            text = f.read()
        
        # NLP分析を実行
        if SPACY_AVAILABLE and analysis_type == 'advanced':
            result = analyze_text_spacy(text)
        else:
            result = analyze_text_simple(text)
        
        # 結果をJSONで出力
        print(json.dumps(result, ensure_ascii=False, indent=2))
        
    except FileNotFoundError:
        print(json.dumps({'error': f'ファイルが見つかりません: {file_path}'}), file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(json.dumps({'error': f'分析中にエラーが発生: {str(e)}'}), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main() 
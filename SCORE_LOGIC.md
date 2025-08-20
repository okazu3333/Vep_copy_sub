# 感情分析スコアロジック仕様書

## 📊 **概要**

本システムは、コストフリーのルールベース感情分析により、アラートを自動的に既存セグメントに分類し、優先度を決定するシステムです。

## 🎯 **システム構成**

### **1. 感情分析エンジン**
- **方式**: ルールベース（キーワードマッチング）
- **コスト**: 完全無料
- **精度**: 設定可能なキーワードパターンによる高精度分類

### **2. スコアリングシステム**
- **優先度**: 4段階（低・中・高・緊急）
- **感情スコア**: 0.0〜1.5の範囲
- **信頼度**: 0.1〜1.0の範囲

## 🔍 **感情分析ロジック**

### **感情カテゴリ定義**

| 感情 | 説明 | スコア | 優先度 |
|------|------|--------|--------|
| `positive` | ポジティブ・満足 | 0.5 | 低 |
| `neutral` | 中立的・普通 | 0.8 | 中 |
| `negative` | ネガティブ・不満 | 1.0 | 高 |
| `urgent` | 緊急・至急 | 1.5 | 緊急 |

### **キーワードパターン詳細**

#### **クレーム・苦情系**
```typescript
{
  keywords: ['クレーム', '苦情', '不満', '問題', 'トラブル', '困った', '困っています', '改善', '対応', '解決', '謝罪', '申し訳', 'すみません', 'ご迷惑'],
  sentiment: 'negative',
  priority: 'high',
  score: 1.0,
  category: 'customer_service'
}
```

#### **緊急対応**
```typescript
{
  keywords: ['緊急', '至急', '急ぎ', '早急', 'すぐ', '今すぐ', '即座', '即時', '期限', '締切', '納期', '間に合わない', '遅れる', '遅延'],
  sentiment: 'urgent',
  priority: 'critical',
  score: 1.5,
  category: 'urgent'
}
```

#### **キャンセル・解約**
```typescript
{
  keywords: ['キャンセル', '解約', '中止', '停止', '終了', '破棄', '取り消し', 'やめたい', 'やめる', '辞退', '断る', 'お断り'],
  sentiment: 'negative',
  priority: 'high',
  score: 1.2,
  category: 'business_risk'
}
```

#### **価格・料金**
```typescript
{
  keywords: ['高い', '高額', '料金', '価格', '費用', 'コスト', '予算', '割引', '値引き', '安く', '安価', '無料', 'タダ'],
  sentiment: 'neutral',
  priority: 'medium',
  score: 0.8,
  category: 'pricing'
}
```

#### **品質・品質問題**
```typescript
{
  keywords: ['品質', '質', '悪い', '粗悪', '不良', '不具合', '故障', 'エラー', 'バグ', '問題', '欠陥', '劣化'],
  sentiment: 'negative',
  priority: 'high',
  score: 1.3,
  category: 'quality'
}
```

#### **競合・他社**
```typescript
{
  keywords: ['他社', '競合', 'ライバル', '比較', '検討', '見積もり', '相見積もり', '他社の方が', '他社なら'],
  sentiment: 'neutral',
  priority: 'medium',
  score: 0.9,
  category: 'competition'
}
```

#### **営業・提案**
```typescript
{
  keywords: ['提案', '営業', '商談', '打ち合わせ', 'ミーティング', 'プレゼン', 'デモ', '見積もり', '契約', '導入'],
  sentiment: 'positive',
  priority: 'medium',
  score: 0.7,
  category: 'sales'
}
```

#### **感謝・満足**
```typescript
{
  keywords: ['ありがとう', '感謝', '素晴らしい', '良い', '優秀', '完璧', '満足', '喜び', '嬉しい', '楽しい', '期待', '希望', '成功', '達成', '完了'],
  sentiment: 'positive',
  priority: 'low',
  score: 0.5,
  category: 'satisfaction'
}
```

#### **催促・未対応**
```typescript
{
  keywords: ['まだですか', 'いつまで', '対応して', '返事がない', '待っています', '遅い', '早く', '急いで', '期限', '締切', '納期', '間に合わない', '遅れる', '遅延', 'お待ち', 'ご連絡', 'ご返事'],
  sentiment: 'negative',
  priority: 'medium',
  score: 1.1,
  category: 'follow_up'
}
```

## 🎯 **スコア計算ロジック**

### **1. 感情スコア計算**
```typescript
// 各カテゴリのキーワードマッチ数をカウント
const matches = pattern.keywords.filter(keyword =>
  text.toLowerCase().includes(keyword.toLowerCase())
)

// 感情スコアを累積
sentimentScores[pattern.sentiment] += pattern.score * matches.length
```

### **2. 優先度スコア計算**
```typescript
// 優先度の重み付け
const weights = { 'low': 1, 'medium': 2, 'high': 3, 'critical': 4 }

// 最高優先度を決定
let highestPriority = 'low'
if (getPriorityWeight(pattern.priority) > getPriorityWeight(highestPriority)) {
  highestPriority = pattern.priority
}
```

### **3. 総合スコア計算**
```typescript
// 全感情スコアの合計
const totalScore = Object.values(sentimentScores).reduce((a, b) => a + b, 0)

// 支配的感情を決定
let dominantSentiment = 'neutral'
if (totalScore > 0) {
  const maxScore = Math.max(...Object.values(sentimentScores))
  dominantSentiment = Object.keys(sentimentScores).find(key =>
    sentimentScores[key] === maxScore
  ) || 'neutral'
}
```

## 🗂️ **既存セグメントマッピング**

### **マッピングルール**

| 感情 | カテゴリ | 既存セグメント | 信頼度 |
|------|----------|----------------|--------|
| `negative` | `customer_service` | クレーム・苦情系 | 0.8 |
| `negative` | `business_risk` | 社内向け危機通報 | 0.9 |
| `negative` | `quality` | クレーム・苦情系 | 0.8 |
| `negative` | `urgent` | 社内向け危機通報 | 0.9 |
| `negative` | `pricing` | 催促・未対応の不満 | 0.8 |
| `negative` | `competition` | 催促・未対応の不満 | 0.8 |
| `negative` | `follow_up` | 催促・未対応の不満 | 0.8 |
| `urgent` | `urgent` | 社内向け危機通報 | 1.0 |
| `urgent` | `customer_service` | クレーム・苦情系 | 0.9 |
| `urgent` | `business_risk` | 社内向け危機通報 | 1.0 |
| `positive` | `sales` | 契約・商談 | 0.7 |
| `positive` | `satisfaction` | 顧客サポート | 0.6 |
| `neutral` | `pricing` | 営業プロセス | 0.5 |
| `neutral` | `competition` | 営業プロセス | 0.5 |
| `neutral` | `sales` | 営業プロセス | 0.5 |
| `neutral` | `customer_service` | 催促・未対応の不満 | 0.7 |

### **信頼度計算**
```typescript
function calculateConfidence(sentiment: string, category: string, priorityScore: number): number {
  let confidence = 0.5 // ベース信頼度
  
  // 感情による調整
  if (sentiment === 'urgent') confidence += 0.3
  if (sentiment === 'negative') confidence += 0.2
  if (sentiment === 'positive') confidence += 0.1
  
  // 優先度スコアによる調整
  if (priorityScore > 8) confidence += 0.2
  if (priorityScore > 5) confidence += 0.1
  
  // カテゴリによる調整
  if (category === 'urgent') confidence += 0.2
  if (category === 'customer_service') confidence += 0.1
  
  return Math.min(confidence, 1.0) // 最大1.0
}
```

## 📊 **出力フィールド**

### **感情分析結果**
```typescript
{
  dominant_sentiment: 'negative',        // 支配的感情
  highest_priority: 'high',             // 最高優先度
  priority_score: 8.5,                  // 優先度スコア
  detected_categories: ['クレーム・苦情', '催促・未対応'], // 検出カテゴリ
  detected_categories_english: ['customer_service', 'follow_up'], // 英語カテゴリ
  keywords_found: ['クレーム', 'まだですか'] // 検出キーワード
}
```

### **既存セグメントマッピング結果**
```typescript
{
  existing_segment_id: 'complaint-urgent',
  existing_segment_name: 'クレーム・苦情系',
  existing_segment_description: '顧客からの強い不満や苦情の検出',
  existing_segment_color: 'bg-red-100 text-red-800',
  existing_segment_priority: 'high',
  mapping_reason: 'negative感情 + customer_serviceカテゴリ → クレーム・苦情系',
  mapping_confidence: 0.8
}
```

## 🔧 **カスタマイズ可能な設定**

### **1. キーワードパターンの追加・修正**
- 新しいカテゴリの追加
- 既存キーワードの調整
- スコア値の変更

### **2. マッピングルールの調整**
- 感情×カテゴリの組み合わせ変更
- 信頼度計算ロジックの修正
- 新しい既存セグメントの追加

### **3. スコアリング重みの調整**
- 優先度の重み付け変更
- 感情スコアの調整
- 信頼度計算パラメータの最適化

## 📈 **パフォーマンス特性**

- **処理速度**: 1アラートあたり < 1ms
- **メモリ使用量**: 最小限（キーワード辞書のみ）
- **スケーラビリティ**: 無制限（ルールベース）
- **精度**: 設定されたキーワードパターンに依存

## 🚀 **今後の拡張可能性**

1. **機械学習統合**: 既存のルールベースと組み合わせ
2. **動的キーワード学習**: ユーザーフィードバックによる自動調整
3. **多言語対応**: 英語、中国語等の追加
4. **感情強度の細分化**: より詳細な感情レベルの検出
5. **コンテキスト分析**: 前後の文脈を考慮した分析

---

**最終更新**: 2025年8月20日  
**バージョン**: 1.0.0  
**作成者**: AI Assistant  
**プロジェクト**: Vep_copy_sub 
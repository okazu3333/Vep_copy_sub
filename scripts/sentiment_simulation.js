#!/usr/bin/env node

/**
 * 感情分析シュミレーションスクリプト
 * 実際のアラートデータを使って、新しい分析ロジックの結果を予測
 */

const fs = require('fs');

// 拡張キーワードパターン（感情分析付き）
const ENHANCED_KEYWORD_PATTERNS = {
  'クレーム・苦情': {
    keywords: ['クレーム', '苦情', '不満', '問題', 'トラブル', '困った', '困っています', '改善', '対応', '解決', '謝罪', '申し訳', 'すみません', 'ご迷惑'],
    sentiment: 'negative',
    priority: 'high',
    score: 1.0,
    category: 'customer_service'
  },
  '緊急対応': {
    keywords: ['緊急', '至急', '急ぎ', '早急', 'すぐ', '今すぐ', '即座', '即時', '期限', '締切', '納期', '間に合わない', '遅れる', '遅延'],
    sentiment: 'urgent',
    priority: 'critical',
    score: 1.5,
    category: 'urgent'
  },
  'キャンセル・解約': {
    keywords: ['キャンセル', '解約', '中止', '停止', '終了', '破棄', '取り消し', 'やめたい', 'やめる', '辞退', '断る', 'お断り'],
    sentiment: 'negative',
    priority: 'high',
    score: 1.2,
    category: 'business_risk'
  },
  '価格・料金': {
    keywords: ['高い', '高額', '料金', '価格', '費用', 'コスト', '予算', '割引', '値引き', '安く', '安価', '無料', 'タダ'],
    sentiment: 'neutral',
    priority: 'medium',
    score: 0.8,
    category: 'pricing'
  },
  '品質・品質問題': {
    keywords: ['品質', '質', '悪い', '粗悪', '不良', '不具合', '故障', 'エラー', 'バグ', '問題', '欠陥', '劣化'],
    sentiment: 'negative',
    priority: 'high',
    score: 1.3,
    category: 'quality'
  },
  '競合・他社': {
    keywords: ['他社', '競合', 'ライバル', '比較', '検討', '見積もり', '相見積もり', '他社の方が', '他社なら'],
    sentiment: 'neutral',
    priority: 'medium',
    score: 0.9,
    category: 'competition'
  },
  '営業・提案': {
    keywords: ['提案', '営業', '商談', '打ち合わせ', 'ミーティング', 'プレゼン', 'デモ', '見積もり', '契約', '導入'],
    sentiment: 'positive',
    priority: 'medium',
    score: 0.7,
    category: 'sales'
  },
  '感謝・満足': {
    keywords: ['ありがとう', '感謝', '素晴らしい', '良い', '優秀', '完璧', '満足', '喜び', '嬉しい', '楽しい', '期待', '希望', '成功', '達成', '完了'],
    sentiment: 'positive',
    priority: 'low',
    score: 0.5,
    category: 'satisfaction'
  }
};

// 感情分析とキーワード検知を実行
function detectKeywordsWithSentiment(text) {
  const detectedKeywords = [];
  const sentimentScores = { positive: 0, negative: 0, urgent: 0, neutral: 0 };
  let totalPriorityScore = 0;
  let highestPriority = 'low';

  // 各パターンをチェック
  Object.entries(ENHANCED_KEYWORD_PATTERNS).forEach(([category, pattern]) => {
    const matches = pattern.keywords.filter(keyword => 
      text.toLowerCase().includes(keyword.toLowerCase())
    );

    if (matches.length > 0) {
      const keywordResult = {
        category: category,
        keywords: matches,
        sentiment: pattern.sentiment,
        priority: pattern.priority,
        score: pattern.score * matches.length,
        category_type: pattern.category
      };

      detectedKeywords.push(keywordResult);

      // 感情スコアを累積
      sentimentScores[pattern.sentiment] += pattern.score * matches.length;
      
      // 優先度スコアを累積
      totalPriorityScore += keywordResult.score;
      
      // 最高優先度を更新
      if (getPriorityWeight(pattern.priority) > getPriorityWeight(highestPriority)) {
        highestPriority = pattern.priority;
      }
    }
  });

  // 感情分析の結果を計算
  const totalScore = Object.values(sentimentScores).reduce((a, b) => a + b, 0);
  let dominantSentiment = 'neutral';
  let confidence = 0;

  if (totalScore > 0) {
    const maxScore = Math.max(...Object.values(sentimentScores));
    dominantSentiment = Object.keys(sentimentScores).find(key => 
      sentimentScores[key] === maxScore
    ) || 'neutral';
    confidence = maxScore / totalScore;
  }

  return {
    detected_keywords: detectedKeywords,
    sentiment_analysis: {
      dominant_sentiment: dominantSentiment,
      confidence: Math.round(confidence * 100) / 100,
      scores: sentimentScores
    },
    priority_analysis: {
      overall_priority: highestPriority,
      highest_priority: highestPriority,
      priority_score: Math.round(totalPriorityScore * 100) / 100
    }
  };
}

function getPriorityWeight(priority) {
  const weights = { 'low': 1, 'medium': 2, 'high': 3, 'critical': 4 };
  return weights[priority] || 1;
}

function analyzeByCategory(detectedKeywords) {
  const categoryBreakdown = {};
  
  detectedKeywords.forEach(keyword => {
    const category = keyword.category_type;
    if (!categoryBreakdown[category]) {
      categoryBreakdown[category] = {
        count: 0,
        total_score: 0,
        keywords: []
      };
    }
    
    categoryBreakdown[category].count++;
    categoryBreakdown[category].total_score += keyword.score;
    categoryBreakdown[category].keywords.push(...keyword.keywords);
  });

  return categoryBreakdown;
}

function generateRecommendations(analysisResult) {
  const recommendations = [];

  // 感情に基づく推奨事項
  if (analysisResult.sentiment_analysis.dominant_sentiment === 'negative') {
    recommendations.push('ネガティブな感情が検出されました。迅速な対応が推奨されます。');
  }
  
  if (analysisResult.sentiment_analysis.dominant_sentiment === 'urgent') {
    recommendations.push('緊急度が高い内容です。最優先での対応が必要です。');
  }

  // 優先度に基づく推奨事項
  if (analysisResult.priority_analysis.highest_priority === 'critical') {
    recommendations.push('クリティカルな優先度です。即座の対応が必要です。');
  }

  // カテゴリに基づく推奨事項
  if (analysisResult.category_breakdown.customer_service) {
    recommendations.push('カスタマーサービス関連の内容です。専門チームへの引き継ぎを検討してください。');
  }

  if (analysisResult.category_analysis.business_risk) {
    recommendations.push('ビジネスリスクが含まれています。経営陣への報告を検討してください。');
  }

  return recommendations;
}

// メイン処理
async function main() {
  try {
    console.log('🔍 感情分析シュミレーション開始...\n');

    // サンプルデータを読み込み
    if (!fs.existsSync('sample_alerts_clean.json')) {
      console.log('❌ sample_alerts_clean.jsonが見つかりません');
      console.log('まず、curlコマンドでデータを取得してください');
      return;
    }

    const sampleData = JSON.parse(fs.readFileSync('sample_alerts_clean.json', 'utf8'));
    console.log(`📊 分析対象: ${sampleData.length}件のアラート\n`);

    // 全体統計
    const overallStats = {
      total_alerts: sampleData.length,
      sentiment_distribution: { positive: 0, negative: 0, urgent: 0, neutral: 0 },
      priority_distribution: { low: 0, medium: 0, high: 0, critical: 0 },
      category_distribution: {},
      average_priority_score: 0,
      total_priority_score: 0
    };

    // 各アラートを分析
    const analysisResults = sampleData.map((alert, index) => {
      const text = `${alert.subject} ${alert.body}`;
      const analysis = detectKeywordsWithSentiment(text);
      
      // 統計を累積
      overallStats.sentiment_distribution[analysis.sentiment_analysis.dominant_sentiment]++;
      overallStats.priority_distribution[analysis.priority_analysis.highest_priority]++;
      overallStats.total_priority_score += analysis.priority_analysis.priority_score;

      // カテゴリ統計
      const categoryBreakdown = analyzeByCategory(analysis.detected_keywords);
      Object.entries(categoryBreakdown).forEach(([category, data]) => {
        if (!overallStats.category_distribution[category]) {
          overallStats.category_distribution[category] = 0;
        }
        overallStats.category_distribution[category] += data.count;
      });

      return {
        index: index + 1,
        subject: alert.subject.substring(0, 50) + '...',
        analysis: analysis
      };
    });

    // 平均スコアを計算
    overallStats.average_priority_score = Math.round(overallStats.total_priority_score / sampleData.length * 100) / 100;

    // 結果を表示
    console.log('📈 全体統計結果');
    console.log('='.repeat(50));
    console.log(`総アラート数: ${overallStats.total_alerts}件`);
    console.log(`平均優先度スコア: ${overallStats.average_priority_score}`);
    console.log('');

    console.log('😊 感情分布');
    console.log('-'.repeat(30));
    Object.entries(overallStats.sentiment_distribution).forEach(([sentiment, count]) => {
      const percentage = Math.round((count / overallStats.total_alerts) * 100);
      console.log(`${sentiment}: ${count}件 (${percentage}%)`);
    });
    console.log('');

    console.log('🚨 優先度分布');
    console.log('-'.repeat(30));
    Object.entries(overallStats.priority_distribution).forEach(([priority, count]) => {
      const percentage = Math.round((count / overallStats.total_alerts) * 100);
      console.log(`${priority}: ${count}件 (${percentage}%)`);
    });
    console.log('');

    console.log('🏷️ カテゴリ分布');
    console.log('-'.repeat(30));
    Object.entries(overallStats.category_distribution)
      .sort(([,a], [,b]) => b - a)
      .forEach(([category, count]) => {
        const percentage = Math.round((count / overallStats.total_alerts) * 100);
        console.log(`${category}: ${count}件 (${percentage}%)`);
      });
    console.log('');

    // 詳細分析結果（上位5件）
    console.log('🔍 詳細分析結果（上位5件）');
    console.log('='.repeat(50));
    analysisResults
      .sort((a, b) => b.analysis.priority_analysis.priority_score - a.analysis.priority_analysis.priority_score)
      .slice(0, 5)
      .forEach((result, index) => {
        console.log(`${index + 1}. ${result.subject}`);
        console.log(`   感情: ${result.analysis.sentiment_analysis.dominant_sentiment} (信頼度: ${result.analysis.sentiment_analysis.confidence})`);
        console.log(`   優先度: ${result.analysis.priority_analysis.highest_priority} (スコア: ${result.analysis.priority_analysis.priority_score})`);
        if (result.analysis.detected_keywords.length > 0) {
          const categories = result.analysis.detected_keywords.map(k => k.category).join(', ');
          console.log(`   カテゴリ: ${categories}`);
        }
        console.log('');
      });

    // セグメント別の件数予測
    console.log('📊 セグメント別件数予測');
    console.log('='.repeat(50));
    
    // 感情別セグメント
    console.log('【感情別セグメント】');
    Object.entries(overallStats.sentiment_distribution).forEach(([sentiment, count]) => {
      if (count > 0) {
        console.log(`• ${sentiment}セグメント: ${count}件`);
      }
    });
    console.log('');

    // 優先度別セグメント
    console.log('【優先度別セグメント】');
    Object.entries(overallStats.priority_distribution).forEach(([priority, count]) => {
      if (count > 0) {
        console.log(`• ${priority}優先度セグメント: ${count}件`);
      }
    });
    console.log('');

    // カテゴリ別セグメント
    console.log('【カテゴリ別セグメント】');
    Object.entries(overallStats.category_distribution)
      .sort(([,a], [,b]) => b - a)
      .forEach(([category, count]) => {
        if (count > 0) {
          console.log(`• ${category}セグメント: ${count}件`);
        }
      });

    console.log('\n✅ シュミレーション完了！');

  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
  }
}

// スクリプト実行
if (require.main === module) {
  main();
}

module.exports = {
  detectKeywordsWithSentiment,
  analyzeByCategory,
  generateRecommendations
}; 
/**
 * キーワード抽出システム
 * メール件名・本文から重要なアラートキーワードを検出
 */

export class KeywordExtractor {
  // 11+のキーワードパターン定義（文字化けCSVの復元版）
  private static readonly KEYWORD_PATTERNS = [
    {
      category: '解約',
      keywords: ['解約', 'キャンセル', '終了', '停止', '廃止'],
      phrases: ['解約したい', '解約の手続き', '解約を希望', '契約終了', '利用停止'],
      priority: 'high',
      businessImpact: '契約収益のリスクが高いため'
    },
    {
      category: '移行',
      keywords: ['移行', '引っ越し', '切り替え', '変更'],
      phrases: ['他社に移行', '移行を検討', '乗り換え', '移行作業', '移行対応'],
      priority: 'high',
      businessImpact: '移行により顧客を失うリスクが高いため'
    },
    {
      category: '価格',
      keywords: ['価格', '料金', '値上げ', 'コスト', '費用', '見積'],
      phrases: ['価格を教えて', '料金の確認', '値上げについて', '料金の見直し'],
      priority: 'high',
      businessImpact: '価格改定は迅速な対応が必要'
    },
    {
      category: '契約',
      keywords: ['契約', '更新', '新規', '署名', '締結'],
      phrases: ['契約更新', '契約の確認', '契約内容', '新規契約'],
      priority: 'high',
      businessImpact: '契約関連は迅速な対応が必要'
    },
    {
      category: 'エラー',
      keywords: ['エラー', '障害', '不具合', '問題', 'トラブル', 'error', 'bug'],
      phrases: ['システム障害', 'エラーが発生', '障害対応', '不具合報告'],
      priority: 'high',
      businessImpact: 'システム障害は即座対応が必要'
    },
    {
      category: '見積もり',
      keywords: ['見積', '見積もり', '価格', 'コスト', '費用', '料金'],
      phrases: ['見積もりが欲しい', '見積書', '価格を知りたい'],
      priority: 'medium',
      businessImpact: '営業プロセスの重要なステップ'
    },
    {
      category: '提案',
      keywords: ['提案', '企画', 'プレゼン', 'デモ', '説明', '紹介'],
      phrases: ['提案書', '企画書', 'デモをお願い', '説明を希望'],
      priority: 'medium',
      businessImpact: '提案は適切な対応が必要'
    },
    {
      category: '返信',
      keywords: ['返信', '回答', '連絡', '確認', '返事'],
      phrases: ['返信がない', '回答をお待ち', '確認したい', '連絡待ち'],
      priority: 'medium',
      businessImpact: 'コミュニケーションの継続性が重要'
    },
    {
      category: '遅延',
      keywords: ['遅延', '遅い', '遅れ', 'スケジュール', '納期', '間に合わない'],
      phrases: ['プロセスの遅延', 'スケジュール調整', '遅れの対応'],
      priority: 'medium',
      businessImpact: 'プロセスの遅延は適時対応が必要'
    },
    {
      category: '期限',
      keywords: ['期限', '締切', 'スケジュール', '日程', '完了', '実施'],
      phrases: ['期限確認', '締切について', '日程調整'],
      priority: 'medium',
      businessImpact: '期限確認は重要'
    },
    {
      category: '会議',
      keywords: ['会議', 'ミーティング', '面談', '打ち合わせ', '日程調整'],
      phrases: ['会議設定', '面談の設定', '日程調整'],
      priority: 'low',
      businessImpact: '会議調整は比較的優先度が低い'
    },
    {
      category: '問い合わせ',
      keywords: ['問い合わせ', '対応', 'サポート', '質問', '相談'],
      phrases: ['一般的な問い合わせ', 'サポート対応', '質問回答'],
      priority: 'low',
      businessImpact: '一般的な問い合わせ'
    },
    {
      category: '報告',
      keywords: ['報告', '情報', '状況', '確認', '共有', '更新'],
      phrases: ['報告書', '状況確認', '報告事項'],
      priority: 'low',
      businessImpact: '報告書は定期的な対応'
    },
    {
      category: 'タスク',
      keywords: ['タスク', '作業', '実施', '完了', '未完了', '進行中'],
      phrases: ['タスク確認', '作業確認', '完了確認'],
      priority: 'low',
      businessImpact: 'タスク確認は通常の業務'
    },
    // 英語パターンも追加
    {
      category: 'urgent',
      keywords: ['urgent', 'critical', 'emergency', 'asap', 'immediately'],
      phrases: ['urgent request', 'critical issue', 'emergency response'],
      priority: 'high',
      businessImpact: 'Urgent matters require immediate attention'
    },
    {
      category: 'important',
      keywords: ['important', 'priority', 'attention', 'review'],
      phrases: ['important update', 'priority item', 'needs attention'],
      priority: 'medium',
      businessImpact: 'Important items need timely response'
    }
  ];

  /**
   * メール件名・本文からキーワードを抽出
   */
  static extractKeywords(subject: string = '', body: string = '', snippet: string = ''): {
    keywords: string[];
    primaryKeyword: string;
    priority: string;
    category: string;
    confidence: number;
  } {
    const text = `${subject} ${body} ${snippet}`.toLowerCase();
    const matches: Array<{
      category: string;
      keyword: string;
      priority: string;
      score: number;
    }> = [];

    // 各パターンでマッチング
    for (const pattern of this.KEYWORD_PATTERNS) {
      // キーワードマッチング
      for (const keyword of pattern.keywords) {
        const keywordLower = keyword.toLowerCase();
        if (text.includes(keywordLower)) {
          matches.push({
            category: pattern.category,
            keyword: keyword,
            priority: pattern.priority,
            score: this.calculateScore(keyword, text, 'keyword')
          });
        }
      }

      // フレーズマッチング（より高スコア）
      for (const phrase of pattern.phrases) {
        const phraseLower = phrase.toLowerCase();
        if (text.includes(phraseLower)) {
          matches.push({
            category: pattern.category,
            keyword: phrase,
            priority: pattern.priority,
            score: this.calculateScore(phrase, text, 'phrase')
          });
        }
      }
    }

    // スコア順にソート
    matches.sort((a, b) => b.score - a.score);

    if (matches.length === 0) {
      return {
        keywords: [],
        primaryKeyword: '',
        priority: 'low',
        category: 'other',
        confidence: 0
      };
    }

    // 上位マッチを選択
    const topMatch = matches[0];
    const allKeywords = matches.slice(0, 3).map(m => m.keyword); // 上位3つ

    return {
      keywords: allKeywords,
      primaryKeyword: topMatch.keyword,
      priority: topMatch.priority,
      category: topMatch.category,
      confidence: Math.min(topMatch.score / 100, 1.0)
    };
  }

  /**
   * キーワードスコア計算
   */
  private static calculateScore(keyword: string, text: string, type: 'keyword' | 'phrase'): number {
    const keywordLower = keyword.toLowerCase();
    const textLower = text.toLowerCase();
    
    let score = 0;

    // 基本マッチスコア
    const occurrences = (textLower.match(new RegExp(keywordLower, 'g')) || []).length;
    score += occurrences * (type === 'phrase' ? 50 : 30);

    // 件名に含まれる場合はボーナス
    if (text.substring(0, 100).toLowerCase().includes(keywordLower)) {
      score += 40;
    }

    // 完全マッチの場合はボーナス
    if (textLower.includes(` ${keywordLower} `) || textLower.startsWith(keywordLower) || textLower.endsWith(keywordLower)) {
      score += 20;
    }

    return score;
  }

  /**
   * バッチでキーワード抽出（データベース更新用）
   */
  static async batchExtractKeywords(
    alerts: Array<{
      id: string;
      message_subject?: string;
      message_body?: string;
      message_snippet?: string;
    }>
  ): Promise<Array<{
    id: string;
    extracted_keyword: string;
    category: string;
    priority: string;
    confidence: number;
  }>> {
    const results = [];

    for (const alert of alerts) {
      const extraction = this.extractKeywords(
        alert.message_subject || '',
        alert.message_body || '',
        alert.message_snippet || ''
      );

      results.push({
        id: alert.id,
        extracted_keyword: extraction.primaryKeyword,
        category: extraction.category,
        priority: extraction.priority,
        confidence: extraction.confidence
      });
    }

    return results;
  }

  /**
   * 統計情報取得
   */
  static getPatternStats() {
    return {
      totalPatterns: this.KEYWORD_PATTERNS.length,
      highPriorityPatterns: this.KEYWORD_PATTERNS.filter(p => p.priority === 'high').length,
      mediumPriorityPatterns: this.KEYWORD_PATTERNS.filter(p => p.priority === 'medium').length,
      lowPriorityPatterns: this.KEYWORD_PATTERNS.filter(p => p.priority === 'low').length,
      categories: this.KEYWORD_PATTERNS.map(p => p.category)
    };
  }
} 
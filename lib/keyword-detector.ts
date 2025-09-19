// キーワード検出とプライオリティ算出
export interface KeywordDetectionResult {
  keyword: string;
  priority: 'high' | 'medium' | 'low';
  confidence: number;
  matchedTerms: string[];
}

export class KeywordDetector {
  
  // キーワードとプライオリティのマッピング（page.tsx 140-154行目のキーワードを統合）
  private static readonly KEYWORD_PRIORITY_MAP = {
    // HIGH PRIORITY - 緊急対応が必要なもの
    '緊急対応': { 
      priority: 'high' as const, 
      keywords: ['緊急', '至急', 'urgent', 'ASAP', '即座', '直ちに', '急ぎ', '今すぐ', '急ぐ'],
      weight: 10 
    },
    '解約・キャンセル': { 
      priority: 'high' as const, 
      keywords: ['解約', 'キャンセル', '終了', '見直し', '他社', '変更', '移行', '競合', '比較'],
      weight: 9 
    },
    'クレーム・問題': { 
      priority: 'high' as const, 
      keywords: ['クレーム', '対応が悪い', '期待外れ', '改善要求', '説明と違う', '品質', '不満', '合わない'],
      weight: 9 
    },
    '担当者変更': { 
      priority: 'high' as const, 
      keywords: ['担当変更', '交代', '別の人', '引き継ぎ', '連絡がない'],
      weight: 8 
    },

    // MEDIUM PRIORITY - 重要だが緊急性は中程度
    '見積・契約': { 
      priority: 'medium' as const, 
      keywords: ['見積', '見積もり', 'お見積り', '見積書', '価格', '料金', '金額', '費用', '契約', '契約書', '条項', '条件', '署名', '合意', '締結', '修正'],
      weight: 7 
    },
    '予算・コスト': { 
      priority: 'medium' as const, 
      keywords: ['値引き', '割引', 'コスト', '予算', '厳しい', '予算削減', 'コストカット', '投資見送り', '凍結', '経費削減', '見送り'],
      weight: 7 
    },
    '効果・成果': { 
      priority: 'medium' as const, 
      keywords: ['効果が出ない', '費用対効果', 'ROI', '活用できていない', '成果', '効果'],
      weight: 6 
    },
    '調査・研究': { 
      priority: 'medium' as const, 
      keywords: ['調査', 'アンケート', 'survey', '研究', 'リサーチ', '分析', '実査'],
      weight: 6 
    },
    'データ納品': { 
      priority: 'medium' as const, 
      keywords: ['納品', 'データ', '送付', '配信', '提供', 'ダウンロード', 'ファイル'],
      weight: 5 
    },
    '納期・期限': { 
      priority: 'medium' as const, 
      keywords: ['納期', '期限', '予定', '間に合う', '遅延', '延期'],
      weight: 5 
    },

    // LOW PRIORITY - 日常業務・定期連絡
    '会議・打合せ': { 
      priority: 'low' as const, 
      keywords: ['会議', 'meeting', '打ち合わせ', '打合せ', 'ミーティング', '相談', '面談', '資料', 'プレゼン', 'デモ', '説明', '紹介'],
      weight: 4 
    },
    '報告・連絡': { 
      priority: 'low' as const, 
      keywords: ['報告', '連絡', '通知', 'お知らせ', '案内', 'ご連絡', '実査開始', '返信', '回答', 'お返事', '確認', '返答'],
      weight: 3 
    },
    '営業・マーケティング': { 
      priority: 'low' as const, 
      keywords: ['営業', 'マーケティング', '販売', 'セールス', '宣伝', '広告', 'キャンペーン', '提案', '優位性', '差別化', '検討'],
      weight: 3 
    },
    'サポート': { 
      priority: 'low' as const, 
      keywords: ['サポート', 'ヘルプ', 'support', '質問', '問い合わせ', 'お問い合わせ'],
      weight: 2 
    }
  };

  /**
   * テキストからキーワードとプライオリティを検出
   */
  static detectKeywordsAndPriority(subject: string, body: string): KeywordDetectionResult {
    const text = `${subject} ${body}`.toLowerCase();
    const detectedKeywords: Array<{category: string, terms: string[], weight: number, priority: 'high' | 'medium' | 'low'}> = [];

    // 各カテゴリをチェック
    for (const [category, config] of Object.entries(this.KEYWORD_PRIORITY_MAP)) {
      const matchedTerms = config.keywords.filter(keyword => 
        text.includes(keyword.toLowerCase())
      );

      if (matchedTerms.length > 0) {
        detectedKeywords.push({
          category,
          terms: matchedTerms,
          weight: config.weight,
          priority: config.priority
        });
      }
    }

    // 結果を決定
    if (detectedKeywords.length === 0) {
      return {
        keyword: 'その他',
        priority: 'low',
        confidence: 0,
        matchedTerms: []
      };
    }

    // 最も重要度の高いキーワードを選択
    const topKeyword = detectedKeywords.reduce((prev, current) => 
      current.weight > prev.weight ? current : prev
    );

    // 信頼度を計算（マッチしたキーワード数と重要度で算出）
    const confidence = Math.min(
      (topKeyword.terms.length * topKeyword.weight) / 10, 
      1
    );

    return {
      keyword: topKeyword.category,
      priority: topKeyword.priority,
      confidence,
      matchedTerms: topKeyword.terms
    };
  }

  /**
   * メールスレッドの判定
   */
  static detectEmailThread(subject: string): {isReply: boolean, threadSubject: string} {
    const cleanSubject = subject.trim();
    const isReply = /^(Re:|RE:|Fwd:|FWD:|返信:|転送:)\s*/i.test(cleanSubject);
    const threadSubject = cleanSubject.replace(/^(Re:|RE:|Fwd:|FWD:|返信:|転送:)\s*/i, '').trim();
    
    return {
      isReply,
      threadSubject
    };
  }

  /**
   * メール本文の品質評価
   */
  static evaluateContentQuality(subject: string, body: string): {score: number, reasons: string[]} {
    const reasons: string[] = [];
    let score = 100;

    // 件名チェック
    if (!subject || subject.length < 3) {
      score -= 20;
      reasons.push('件名が短すぎる');
    }

    // 本文チェック
    if (!body || body.length < 10) {
      score -= 30;
      reasons.push('本文が短すぎる');
    }

    // エンコーディング問題チェック
    if (body.includes('$B') || body.includes('(B')) {
      score -= 25;
      reasons.push('JISエンコーディング問題');
    }

    if (/^[A-Za-z0-9+/=]+$/.test(body) && body.length > 50) {
      score -= 25;
      reasons.push('Base64エンコーディング問題');
    }

    // 日本語含有率チェック
    const japaneseRatio = this.calculateJapaneseRatio(body);
    if (japaneseRatio < 0.3) {
      score -= 15;
      reasons.push('日本語比率が低い');
    }

    return {
      score: Math.max(score, 0),
      reasons
    };
  }

  /**
   * 日本語比率を計算
   */
  private static calculateJapaneseRatio(text: string): number {
    if (!text) return 0;
    
    const totalChars = text.length;
    const japaneseChars = (text.match(/[ひらがな]|[カタカナ]|[一-龯]|[あ-ん]|[ア-ン]|[亜-熙]/gu) || []).length;
    
    return japaneseChars / totalChars;
  }
} 
// 高度なデコーディングライブラリ
export class AdvancedDecoder {
  
  /**
   * 複数段階のデコード処理
   */
  static decodeMultiLayer(text: string): string {
    if (!text || typeof text !== 'string') return '';
    
    let result = text;
    let previousResult = '';
    let iterations = 0;
    const maxIterations = 5; // 無限ループ防止
    
    // 複数回デコードを試行（ネストしたエンコーディングに対応）
    while (result !== previousResult && iterations < maxIterations) {
      previousResult = result;
      result = this.singleDecodeAttempt(result);
      iterations++;
    }
    
    return result;
  }
  
  /**
   * 単一のデコード試行
   */
  private static singleDecodeAttempt(text: string): string {
    // 1. Base64デコード
    const base64Decoded = this.tryBase64Decode(text);
    if (base64Decoded !== text) return base64Decoded;
    
    // 2. URLデコード
    const urlDecoded = this.tryURLDecode(text);
    if (urlDecoded !== text) return urlDecoded;
    
    // 3. HTMLエンティティデコード
    const htmlDecoded = this.tryHtmlDecode(text);
    if (htmlDecoded !== text) return htmlDecoded;
    
    // 4. JISデコード
    const jisDecoded = this.tryJISDecode(text);
    if (jisDecoded !== text) return jisDecoded;
    
    // 5. UTF-8文字化けデコード（新規追加）
    const utf8Decoded = this.tryUTF8Decode(text);
    if (utf8Decoded !== text) return utf8Decoded;
    
    // 6. バイト文字列デコード（新規追加）
    const byteDecoded = this.tryByteStringDecode(text);
    if (byteDecoded !== text) return byteDecoded;
    
    return text;
  }
  
  /**
   * Base64デコード試行
   */
  private static tryBase64Decode(text: string): string {
    // Base64の特徴をより厳密にチェック
    if (!/^[A-Za-z0-9+/=\s]+$/.test(text) || text.length < 4) {
      return text;
    }
    
    // 改行や空白を除去
    const cleanText = text.replace(/[\s\n\r]/g, '');
    
    // Base64の長さが4の倍数でない場合はパディング
    const paddedText = this.addBase64Padding(cleanText);
    
    try {
      const decoded = Buffer.from(paddedText, 'base64').toString('utf-8');
      
      // デコード結果が有効かチェック
      if (this.isValidDecodedText(decoded, text)) {
        return decoded;
      }
      
      return text;
    } catch {
      return text;
    }
  }
  
  /**
   * Base64パディングを追加
   */
  private static addBase64Padding(text: string): string {
    const remainder = text.length % 4;
    if (remainder === 0) return text;
    
    const padding = '='.repeat(4 - remainder);
    return text + padding;
  }
  
  /**
   * URLデコード試行
   */
  private static tryURLDecode(text: string): string {
    if (!text.includes('%')) return text;
    
    try {
      return decodeURIComponent(text);
    } catch {
      return text;
    }
  }
  
  /**
   * HTMLエンティティデコード試行
   */
  private static tryHtmlDecode(text: string): string {
    if (!text.includes('&') || !text.includes(';')) return text;
    
    const htmlEntities: Record<string, string> = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#39;': "'",
      '&nbsp;': ' ',
      '&copy;': '©',
      '&reg;': '®',
      '&trade;': '™'
    };
    
    let result = text;
    for (const [entity, char] of Object.entries(htmlEntities)) {
      result = result.replace(new RegExp(entity, 'g'), char);
    }
    
    // 数値エンティティのデコード
    result = result.replace(/&#(\d+);/g, (_, num) => 
      String.fromCharCode(parseInt(num, 10))
    );
    
    return result;
  }
  
  /**
   * JISデコード試行
   */
  private static tryJISDecode(text: string): string {
    if (!text.includes('$B') && !text.includes('(B')) {
      return text;
    }
    
    // 拡張JISマッピング
    const jisMap: Record<string, string> = {
      '$B3te$2$^$9!# (B': 'ありがとうございます。',
      '$B$*Hh$lMM$G$9!# (B': 'お疲れ様です。',
      '$B$4MxMQCf$N (B': 'ご利用中の',
      '$B2q0w (B': '会員',
      '$B%j%5!<%A (B': 'リサーチ',
      '$B%/%i%$%"%s%H (B': 'クライアント',
      '$BJ!86$5$s (B': '福田さん',
      '$B$h$m$7$/$*4j$$$$$?$7ま$9 (B': 'よろしくお願いいたします',
      '$B%G!<%? (B': 'データ',
      '$BD4:: (B': '調査',
      '$B%0%m!<%P%k (B': 'グローバル',
      '$B%+%9%?%^!< (B': 'カスタマー',
      '$B%=%j%e!<%7%g%s (B': 'ソリューション',
      '$B%"%5%$%s (B': 'アサイン',
      '$B@_7W (B': '設計',
      '$B3+H/ (B': '開発',
      '$B%F%9%H (B': 'テスト'
    };
    
    let result = text;
    for (const [jis, japanese] of Object.entries(jisMap)) {
      result = result.replace(new RegExp(jis.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), japanese);
    }
    
    return result;
  }
  
  /**
   * UTF-8文字化けデコード試行
   */
  private static tryUTF8Decode(text: string): string {
    try {
      // 実際の文字化けパターンのマッピング
      const utf8Map: Record<string, string> = {
        // 実際に確認された文字化けパターン
        'äºä¾': '事依',
        'ä»é ¼': '仕頼',
        'JOBNo': 'JOBNo',
        '©ç¨': '調用',
        'æ ä¸­': '査中',
        'åï¼¿': '国_',
        'æ®åª': '殺傷',
        'µäº': '事事',
        '°è¦ä»': '見積仕',
        'äºä¾é ¼': '事依頼'
      };
      
      let result = text;
      for (const [garbled, correct] of Object.entries(utf8Map)) {
        result = result.replace(new RegExp(garbled, 'g'), correct);
      }
      
      return result;
    } catch {
      return text;
    }
  }
  
  /**
   * バイト文字列デコード試行
   */
  private static tryByteStringDecode(text: string): string {
    try {
      // Latin-1として誤解釈されたUTF-8を修正
      if (text.includes('Ã') || text.includes('â') || text.includes('°')) {
        // UTF-8バイトシーケンスの復元を試行
        const bytes = [];
        for (let i = 0; i < text.length; i++) {
          bytes.push(text.charCodeAt(i));
        }
        
        // UTF-8として再解釈
        const corrected = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(bytes));
        if (corrected !== text && this.containsJapanese(corrected)) {
          return corrected;
        }
      }
      
      return text;
    } catch {
      return text;
    }
  }
  
  /**
   * 日本語文字が含まれているかチェック
   */
  private static containsJapanese(text: string): boolean {
    return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text);
  }
  
  /**
   * デコード結果が有効かチェック
   */
  private static isValidDecodedText(decoded: string, original: string): boolean {
    // 元のテキストより極端に短い場合は無効
    if (decoded.length < original.length * 0.1) return false;
    
    // 日本語文字が含まれている場合は有効
    if (/[あ-ん]|[ア-ン]|[亜-熙]|[ひらがな]|[カタカナ]|[一-龯]/u.test(decoded)) {
      return true;
    }
    
    // 英語として意味のあるテキストかチェック
    if (/^[a-zA-Z0-9\s.,!?;:()\-\r\n]+$/.test(decoded) && decoded.includes(' ')) {
      return true;
    }
    
    // デコード結果に制御文字や不正な文字が含まれていないかチェック
    if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(decoded)) {
      return false;
    }
    
    return false;
  }
  
  /**
   * テキストの言語を検出
   */
  static detectLanguage(text: string): 'japanese' | 'english' | 'mixed' | 'unknown' {
    if (!text) return 'unknown';
    
    const japaneseChars = (text.match(/[あ-ん]|[ア-ン]|[亜-熙]|[ひらがな]|[カタカナ]|[一-龯]/gu) || []).length;
    const englishChars = (text.match(/[a-zA-Z]/g) || []).length;
    const totalChars = text.length;
    
    const japaneseRatio = japaneseChars / totalChars;
    const englishRatio = englishChars / totalChars;
    
    if (japaneseRatio > 0.3) {
      return englishRatio > 0.2 ? 'mixed' : 'japanese';
    } else if (englishRatio > 0.5) {
      return 'english';
    }
    
    return 'unknown';
  }
  
  /**
   * テキストの品質を評価
   */
  static evaluateTextQuality(text: string): {score: number, issues: string[]} {
    if (!text) return {score: 0, issues: ['テキストが空']};
    
    const issues: string[] = [];
    let score = 100;
    
    // Base64が残っている
    if (/^[A-Za-z0-9+/=]{20,}/.test(text)) {
      score -= 30;
      issues.push('Base64エンコードが残存');
    }
    
    // JISが残っている
    if (text.includes('$B') || text.includes('(B')) {
      score -= 25;
      issues.push('JISエンコードが残存');
    }
    
    // URLエンコードが残っている
    if (text.includes('%') && /%[0-9A-F]{2}/i.test(text)) {
      score -= 20;
      issues.push('URLエンコードが残存');
    }
    
    // 制御文字が含まれている
    if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(text)) {
      score -= 15;
      issues.push('制御文字が含まれている');
    }
    
    // 文字化けの可能性
    if (/[��]/.test(text)) {
      score -= 20;
      issues.push('文字化けの可能性');
    }
    
    return {score: Math.max(score, 0), issues};
  }
} 

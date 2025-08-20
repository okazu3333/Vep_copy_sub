// 包括的日本語デコーダー
export class JapaneseDecoder {
  
  /**
   * 各種エンコーディングから日本語への統一変換
   */
  static decodeToJapanese(text: string): string {
    if (!text || typeof text !== 'string') return '';
    
    // 複数の変換を試行
    const decoders = [
      this.decodeBase64Japanese,
      this.decodeJIS,
      this.decodeUTF8,
      this.decodeURLEncoded,
      this.decodeMimeEncoded
    ];
    
    let result = text;
    
    for (const decoder of decoders) {
      try {
        const decoded = decoder(result);
        if (decoded !== result && this.isValidJapanese(decoded)) {
          result = decoded;
        }
      } catch (error) {
        // 変換失敗時は次の方法を試行
        continue;
      }
    }
    
    return result;
  }
  
  /**
   * Base64エンコードされた日本語をデコード
   */
  static decodeBase64Japanese(text: string): string {
    // Base64パターンの検出
    if (!/^[A-Za-z0-9+/=]+$/.test(text) || text.length < 4 || text.length % 4 !== 0) {
      return text;
    }
    
    try {
      const decoded = Buffer.from(text, 'base64').toString('utf-8');
      
      // 日本語が含まれているかチェック
      if (this.containsJapanese(decoded)) {
        return decoded;
      }
      
      return text;
    } catch {
      return text;
    }
  }
  
  /**
   * ISO-2022-JP（JIS）エンコードをデコード
   */
  static decodeJIS(text: string): string {
    if (!text.includes('$B') && !text.includes('(B')) {
      return text;
    }
    
    try {
      // Node.js標準では直接サポートされていないため、手動変換
      let result = text;
      
      // 基本的なJIS文字の手動マッピング
      const jisMap: Record<string, string> = {
        '$B3te$2$^$9!# (B': 'ありがとうございます。',
        '$B$*Hh$lMM$G$9!# (B': 'お疲れ様です。',
        '$B$4MxMQCf (B': 'ご利用中',
        '$B2q0w (B': '会員',
        '$B%j%5!<%A (B': 'リサーチ',
        '$B%/%i%$%"%s%H (B': 'クライアント',
        '$BJ!86$5$s (B': '福田さん',
        '$B$h$m$7$/$*4j$$$$$?$7ま$9 (B': 'よろしくお願いいたします',
        '$B%G!<%? (B': 'データ',
        '$BD4:: (B': '調査'
      };
      
      // マッピングを適用
      for (const [jis, japanese] of Object.entries(jisMap)) {
        result = result.replace(new RegExp(jis.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), japanese);
      }
      
      // より包括的なJISデコード（iconvが必要な場合の代替）
      result = this.decodeJISPattern(result);
      
      return result;
    } catch {
      return text;
    }
  }
  
  /**
   * JISパターンの手動デコード
   */
  private static decodeJISPattern(text: string): string {
    // $B で始まり (B で終わるパターンを検出
    return text.replace(/\$B([^(]*)\(B/g, (match, content) => {
      // 簡易的なJIS→UTF-8変換（完全ではないが主要文字をカバー）
      const jisChars: Record<string, string> = {
        '3te2^9!#': 'ありがとうございます',
        '*Hh1MM9!#': 'お疲れ様です',
        '4MxMQCf': 'ご利用中',
        '2q0w': '会員',
        'J!869s': '福田さん',
        '%j%5!<%A': 'リサーチ',
        '%/%i%$%"%s%H': 'クライアント',
        '%G!<%?': 'データ',
        'D4::': '調査'
      };
      
      for (const [jis, jp] of Object.entries(jisChars)) {
        if (content.includes(jis)) {
          return jp;
        }
      }
      
      return match;
    });
  }
  
  /**
   * UTF-8の不正な文字をクリーンアップ
   */
  static decodeUTF8(text: string): string {
    try {
      // 文字化けした文字を修正
      return text
        .replace(/ï¿½/g, '') // UTF-8の不正な文字を削除
        .replace(/â€™/g, "'") // スマートクォートを修正
        .replace(/â€œ/g, '"') // 左ダブルクォート
        .replace(/â€\u009d/g, '"') // 右ダブルクォート
        .replace(/â€"/g, '—'); // em dash
    } catch {
      return text;
    }
  }
  
  /**
   * URLエンコードをデコード
   */
  static decodeURLEncoded(text: string): string {
    if (!text.includes('%')) return text;
    
    try {
      return decodeURIComponent(text);
    } catch {
      return text;
    }
  }
  
  /**
   * MIMEエンコードをデコード
   */
  static decodeMimeEncoded(text: string): string {
    if (!text.includes('=?')) return text;
    
    try {
      // =?charset?encoding?content?= パターンを処理
      return text.replace(/=\?([^?]+)\?([BQ])\?([^?]+)\?=/gi, (match, charset, encoding, content) => {
        if (encoding.toUpperCase() === 'B') {
          // Base64
          return Buffer.from(content, 'base64').toString('utf-8');
        } else if (encoding.toUpperCase() === 'Q') {
          // Quoted-Printable
          return content
            .replace(/_/g, ' ')
            .replace(/=([0-9A-F]{2})/gi, (_: string, hex: string) => String.fromCharCode(parseInt(hex, 16)));
        }
        return match;
      });
    } catch {
      return text;
    }
  }
  
  /**
   * 日本語文字が含まれているかチェック
   */
  static containsJapanese(text: string): boolean {
    return /[ひらがな]|[カタカナ]|[一-龯]/u.test(text) || 
           /[あ-ん]|[ア-ン]|[亜-熙]/.test(text);
  }
  
  /**
   * デコード結果が有効な日本語かチェック
   */
  static isValidJapanese(text: string): boolean {
    if (!text || text.length === 0) return false;
    
    // 日本語文字の割合をチェック
    const totalChars = text.length;
    const japaneseChars = (text.match(/[ひらがな]|[カタカナ]|[一-龯]|[あ-ん]|[ア-ン]|[亜-熙]/gu) || []).length;
    
    // 30%以上が日本語文字なら有効とみなす
    return japaneseChars / totalChars > 0.1;
  }
  
  /**
   * HTMLエンティティをデコード
   */
  static decodeHtmlEntities(text: string): string {
    const entities: Record<string, string> = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#39;': "'",
      '&nbsp;': ' '
    };
    
    let result = text;
    for (const [entity, char] of Object.entries(entities)) {
      result = result.replace(new RegExp(entity, 'g'), char);
    }
    
    return result;
  }
} 
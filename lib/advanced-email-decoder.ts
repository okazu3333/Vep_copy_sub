import { EmailDecoder } from './email-decoder';

/**
 * 高度なメールデコーダー - 残りの文字化けを解決
 */
export class AdvancedEmailDecoder extends EmailDecoder {
  
  /**
   * 日本語文字化けパターンの検出と修復
   */
  static fixJapaneseGarbled(text: string): string {
    if (!text) return text;
    
    // 一般的な日本語文字化けパターン
    const garbledPatterns = [
      // ISO-2022-JP関連
      ['ã\x81\x82', 'あ'], ['ã\x81\x84', 'い'], ['ã\x81\x86', 'う'], ['ã\x81\x88', 'え'], ['ã\x81\x8a', 'お'],
      ['ã\x81\x8b', 'か'], ['ã\x81\x8d', 'き'], ['ã\x81\x8f', 'く'], ['ã\x81\x91', 'け'], ['ã\x81\x93', 'こ'],
      ['ã\x81\x95', 'さ'], ['ã\x81\x97', 'し'], ['ã\x81\x99', 'す'], ['ã\x81\x9b', 'せ'], ['ã\x81\x9d', 'そ'],
      ['ã\x81\x9f', 'た'], ['ã\x81\xa1', 'ち'], ['ã\x81\xa4', 'つ'], ['ã\x81\xa6', 'て'], ['ã\x81\xa8', 'と'],
      ['ã\x81\xaa', 'な'], ['ã\x81\xab', 'に'], ['ã\x81\xac', 'ぬ'], ['ã\x81\xad', 'ね'], ['ã\x81\xae', 'の'],
      ['ã\x81\xaf', 'は'], ['ã\x81\xb2', 'ひ'], ['ã\x81\xb5', 'ふ'], ['ã\x81\xb8', 'へ'], ['ã\x81\xbb', 'ほ'],
      ['ã\x81\xbe', 'ま'], ['ã\x81\xbf', 'み'], ['ã\x82\x80', 'む'], ['ã\x82\x81', 'め'], ['ã\x82\x82', 'も'],
      ['ã\x82\x84', 'や'], ['ã\x82\x86', 'ゆ'], ['ã\x82\x88', 'よ'],
      ['ã\x82\x89', 'ら'], ['ã\x82\x8a', 'り'], ['ã\x82\x8b', 'る'], ['ã\x82\x8c', 'れ'], ['ã\x82\x8d', 'ろ'],
      ['ã\x82\x8f', 'わ'], ['ã\x82\x92', 'を'], ['ã\x82\x93', 'ん'],
      
      // カタカナ
      ['ã\x82\xa2', 'ア'], ['ã\x82\xa4', 'イ'], ['ã\x82\xa6', 'ウ'], ['ã\x82\xa8', 'エ'], ['ã\x82\xaa', 'オ'],
      ['ã\x82\xab', 'カ'], ['ã\x82\xad', 'キ'], ['ã\x82\xaf', 'ク'], ['ã\x82\xb1', 'ケ'], ['ã\x82\xb3', 'コ'],
      ['ã\x82\xb5', 'サ'], ['ã\x82\xb7', 'シ'], ['ã\x82\xb9', 'ス'], ['ã\x82\xbb', 'セ'], ['ã\x82\xbd', 'ソ'],
      ['ã\x82\xbf', 'タ'], ['ã\x83\x81', 'チ'], ['ã\x83\x84', 'ツ'], ['ã\x83\x86', 'テ'], ['ã\x83\x88', 'ト'],
      ['ã\x83\x8a', 'ナ'], ['ã\x83\x8b', 'ニ'], ['ã\x83\x8c', 'ヌ'], ['ã\x83\x8d', 'ネ'], ['ã\x83\x8e', 'ノ'],
      ['ã\x83\x8f', 'ハ'], ['ã\x83\x92', 'ヒ'], ['ã\x83\x95', 'フ'], ['ã\x83\x98', 'ヘ'], ['ã\x83\x9b', 'ホ'],
      ['ã\x83\x9e', 'マ'], ['ã\x83\x9f', 'ミ'], ['ã\x83\xa0', 'ム'], ['ã\x83\xa1', 'メ'], ['ã\x83\xa2', 'モ'],
      ['ã\x83\xa4', 'ヤ'], ['ã\x83\xa6', 'ユ'], ['ã\x83\xa8', 'ヨ'],
      ['ã\x83\xa9', 'ラ'], ['ã\x83\xaa', 'リ'], ['ã\x83\xab', 'ル'], ['ã\x83\xac', 'レ'], ['ã\x83\xad', 'ロ'],
      ['ã\x83\xaf', 'ワ'], ['ã\x83\xb2', 'ヲ'], ['ã\x83\xb3', 'ン'],
      
      // 漢字（よく使われるもの）
      ['ã\x81\x82ã\x82\x8aã\x81\x8cã\x81\xa8ã\x81\x86', 'ありがとう'],
      ['ã\x81\x8aã\x81\xb2ã\x81\x97ã\x82\x83ã\x81\xbeã\x81\xa7', 'お疲れ様でした'],
      ['ã\x81\x94ã\x81\xa1ã\x82\x89ã\x82\x93', 'ご注文'],
      ['ã\x82\x88ã\x82\x8dã\x81\x97ã\x81\x8f', 'よろしく'],
      
      // よくある単語
      ['ã\x83¡ã\x83¼ã\x83«', 'メール'],
      ['ã\x83\x87ã\x83¼ã\x82¿', 'データ'],
      ['ã\x82¨ã\x83©ã\x83¼', 'エラー'],
      ['ã\x83¦ã\x83¼ã\x82¶ã\x83¼', 'ユーザー'],
      ['ã\x82·ã\x82¹ã\x83\x86ã\x83 ', 'システム'],
      ['ã\x83\x95ã\x82¡ã\x82¤ã\x83«', 'ファイル'],
      ['ã\x83\x97ã\x83­ã\x82°ã\x83©ã\x83 ', 'プログラム'],
      ['ã\x82¢ã\x83\x97ã\x83ªã\x82±ã\x83¼ã\x82·ã\x83§ã\x83³', 'アプリケーション'],
    ];
    
    let fixed = text;
    for (const [garbled, correct] of garbledPatterns) {
      if (fixed.includes(garbled)) {
        fixed = fixed.replace(new RegExp(garbled.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), correct);
      }
    }
    
    return fixed;
  }
  
  /**
   * Base64エンコードされた日本語の検出と修復
   */
  static fixBase64Japanese(text: string): string {
    if (!text) return text;
    
    // Base64パターンを検出
    const base64Pattern = /([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?/g;
    
    return text.replace(base64Pattern, (match) => {
      try {
        if (match.length > 8) { // 短すぎるものは除外
          const decoded = Buffer.from(match, 'base64').toString('utf8');
          // 日本語文字が含まれているかチェック
          if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(decoded)) {
            return decoded;
          }
        }
      } catch (error) {
        // デコードに失敗した場合は元の文字列を返す
      }
      return match;
    });
  }
  
  /**
   * URLエンコードされた日本語の修復
   */
  static fixUrlEncodedJapanese(text: string): string {
    if (!text) return text;
    
    try {
      // %エンコードされた文字列を検出
      if (text.includes('%')) {
        return decodeURIComponent(text);
      }
    } catch (error) {
      // デコードに失敗した場合は元の文字列を返す
    }
    
    return text;
  }
  
  /**
   * 全角・半角の正規化
   */
  static normalizeWidth(text: string): string {
    if (!text) return text;
    
    // 全角英数字を半角に変換
    return text.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (match) => {
      return String.fromCharCode(match.charCodeAt(0) - 0xFEE0);
    });
  }
  
  /**
   * 高度なデコード処理
   */
  static advancedDecode(text: string): string {
    if (!text) return text;
    
    let result = text;
    
    // 1. 基本的なMIMEデコード
    result = super.decodeMimeHeader(result);
    
    // 2. Quoted-Printableデコード
    result = super.decodeQuotedPrintable(result);
    
    // 3. 日本語文字化けパターンの修復
    result = this.fixJapaneseGarbled(result);
    
    // 4. Base64日本語の修復
    result = this.fixBase64Japanese(result);
    
    // 5. URLエンコード日本語の修復
    result = this.fixUrlEncodedJapanese(result);
    
    // 6. 全角・半角の正規化
    result = this.normalizeWidth(result);
    
    // 7. 既存のgarbled textパターンも適用
    result = super.fixGarbledText(result);
    
    return result.trim();
  }
  
  /**
   * データ品質スコアの再計算
   */
  static calculateQualityScore(emailData: any): number {
    const checks = [
      !!emailData.from_email?.trim(),
      !!emailData.to_email?.trim(),
      !!emailData.decoded_subject?.trim(),
      !!emailData.decoded_body?.trim(),
      // 追加チェック：日本語が正しくデコードされているか
      this.hasValidJapanese(emailData.decoded_subject) || this.hasValidJapanese(emailData.decoded_body),
    ];
    
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }
  
  /**
   * 有効な日本語文字が含まれているかチェック
   */
  static hasValidJapanese(text: string): boolean {
    if (!text) return false;
    
    // ひらがな、カタカナ、漢字のいずれかが含まれているかチェック
    return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text);
  }
  
  /**
   * エンコーディング品質の判定
   */
  static assessEncodingQuality(originalText: string, decodedText: string): string {
    if (!originalText) return 'unknown';
    
    // MIMEエンコードが含まれていた場合
    if (originalText.includes('=?') && originalText !== decodedText) {
      return 'decoded';
    }
    
    // 文字化けパターンが修復された場合
    if (this.fixJapaneseGarbled(originalText) !== originalText) {
      return 'decoded';
    }
    
    // その他の修復が行われた場合
    if (originalText !== decodedText) {
      return 'decoded';
    }
    
    return 'clean';
  }
} 
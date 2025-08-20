/**
 * アラートID生成ユーティリティ
 * ALT-xxxx形式のランダムIDを生成
 */
export class AlertIdGenerator {
  private static readonly PREFIX = 'ALT-';
  private static readonly ID_LENGTH = 4;
  
  /**
   * ALT-xxxx形式のランダムなアラートIDを生成
   * @returns {string} ALT-xxxx形式のID
   */
  static generateAlertId(): string {
    const randomNumber = Math.floor(Math.random() * 10000);
    const paddedNumber = randomNumber.toString().padStart(this.ID_LENGTH, '0');
    return `${this.PREFIX}${paddedNumber}`;
  }
  
  /**
   * メールIDをベースにした一意なアラートIDを生成
   * 同じメールIDには常に同じアラートIDを返す
   * @param {string} messageId - 元のメールID
   * @returns {string} ALT-xxxx形式のID
   */
  static generateConsistentAlertId(messageId: string): string {
    // メールIDから簡単なハッシュを生成
    let hash = 0;
    for (let i = 0; i < messageId.length; i++) {
      const char = messageId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 32bit整数に変換
    }
    
    // 負の数を正の数に変換し、4桁に調整
    const positiveHash = Math.abs(hash) % 10000;
    const paddedNumber = positiveHash.toString().padStart(this.ID_LENGTH, '0');
    
    return `${this.PREFIX}${paddedNumber}`;
  }
  
  /**
   * アラートIDが有効なフォーマットかチェック
   * @param {string} alertId - チェックするアラートID
   * @returns {boolean} 有効な形式かどうか
   */
  static isValidAlertId(alertId: string): boolean {
    const pattern = new RegExp(`^${this.PREFIX}\\d{${this.ID_LENGTH}}$`);
    return pattern.test(alertId);
  }
} 
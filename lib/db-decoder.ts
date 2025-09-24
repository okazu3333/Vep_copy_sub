import { EmailDecoder } from './email-decoder'

/**
 * データベース層でのデコード処理
 * データベースから取得したデータを自動的にデコード
 */
export class DatabaseDecoder {
  
  /**
   * アラートデータをデコード
   */
  static decodeAlertData(alertData: any) {
    if (!alertData) return null;
    
    // 配列オブジェクト文字列の修正
    const parseArrayString = (arrayStr: string) => {
      if (!arrayStr) return '';
      
      // [, , , ] のような配列表記を検出
      if (arrayStr.startsWith('[') && arrayStr.endsWith(']')) {
        // 空の配列表記の場合
        if (arrayStr.match(/^\[\s*,?\s*\]$/)) {
          return '';
        }
        
        // Message objectが含まれている場合
        if (arrayStr.includes('<email.message.Message object')) {
          return ''; // 空文字列として扱う
        }
        
        try {
          const content = arrayStr.slice(1, -1); // [ ] を除去
          const items = content.split(',').map(item => item.trim()).filter(item => item && item !== '');
          return items.join('\n');
        } catch {
          return '';
        }
      }
      
      return arrayStr;
    };
    
    return {
      ...alertData,
      // 基本フィールドのデコード（配列文字列修正含む）
      message_subject: EmailDecoder.decodeEmailData({ 
        message_subject: parseArrayString(alertData.message_subject || '') 
      }).message_subject,
      message_body: alertData.message_body || '',
      customer_name: EmailDecoder.decodeEmailData({ 
        customer_name: alertData.customer_name 
      }).customer_name,
      customer_company: EmailDecoder.decodeMimeHeader(alertData.customer_company || ''),
      detected_keyword: EmailDecoder.decodeEmailData({ 
        detected_keyword: alertData.detected_keyword 
      }).detected_keyword,
      
      // 追加フィールドのデコード
      message_snippet: alertData.message_snippet ? 
        EmailDecoder.decodeEmailData({ message_snippet: alertData.message_snippet }).message_snippet : '',
      
      // 日時フォーマット
      datetime: alertData.datetime ? 
        new Date(alertData.datetime).toLocaleString('ja-JP', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        }) : '不明',
      
      // スコアの正規化
      score: Math.round((alertData.score || 0) * 100) / 100,
      
      // レベルとステータスの正規化
      level: (alertData.level || 'medium').toLowerCase(),
      status: alertData.status || 'pending'
    };
  }
  
  /**
   * アラートリストを一括デコード
   */
  static decodeAlertList(alertList: any[]) {
    if (!Array.isArray(alertList)) return [];
    
    return alertList.map(alert => this.decodeAlertData(alert));
  }
  
  /**
   * 検索結果をデコード
   */
  static decodeSearchResults(results: any) {
    if (!results || !results.alerts) return results;
    
    return {
      ...results,
      alerts: this.decodeAlertList(results.alerts)
    };
  }
  
  /**
   * データベースクエリ結果をデコード
   */
  static decodeQueryResult(queryResult: any) {
    if (!queryResult || !queryResult.rows) return queryResult;
    
    return {
      ...queryResult,
      rows: this.decodeAlertList(queryResult.rows)
    };
  }
} 

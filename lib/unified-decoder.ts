import { EmailDecoder } from './email-decoder'
import { DatabaseDecoder } from './db-decoder'

/**
 * 統合デコード処理システム
 * BigQuery、CloudSQL、フロントエンドの全層で一貫したデコード処理
 */
export class UnifiedDecoder {
  
  /**
   * BigQuery用の高性能デコード処理
   */
  static async decodeBigQueryBatch(records: any[], options = {}) {
    const {
      batchSize = 1000,
      enableCache = true,
      logProgress = true
    } = options;
    
    const results = [];
    const cache = enableCache ? new Map() : null;
    
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      
      if (logProgress) {
        console.log(`🔄 デコード処理中: ${i + 1}/${records.length}`);
      }
      
      const decodedBatch = await Promise.all(
        batch.map(record => this.decodeBigQueryRecord(record, cache))
      );
      
      results.push(...decodedBatch);
    }
    
    return results;
  }
  
  /**
   * BigQuery単一レコードのデコード
   */
  static async decodeBigQueryRecord(record: any, cache?: Map<string, string>) {
    try {
      const decoded = {
        ...record,
        // 基本フィールドのデコード
        subject: this.decodeWithCache(record.subject, cache),
        body: this.decodeWithCache(record.body, cache),
        from_email: this.normalizeEmail(record.from_email),
        to_email: this.normalizeEmail(record.to_email),
        
        // メタデータ
        decoded_at: new Date().toISOString(),
        encoding_quality: this.assessEncodingQuality(record),
        
        // 検索用正規化フィールド
        search_subject: this.normalizeForSearch(record.subject),
        search_body: this.normalizeForSearch(record.body),
        
        // 日本語検出フラグ
        has_japanese: this.detectJapanese(record.subject + ' ' + record.body),
        
        // データ品質スコア
        quality_score: this.calculateQualityScore(record)
      };
      
      return decoded;
      
    } catch (error) {
      console.warn('BigQueryレコードデコードエラー:', error);
      return {
        ...record,
        decode_error: error.message,
        decoded_at: new Date().toISOString()
      };
    }
  }
  
  /**
   * キャッシュ付きデコード
   */
  static decodeWithCache(text: string, cache?: Map<string, string>): string {
    if (!text || typeof text !== 'string') return '';
    
    if (cache && cache.has(text)) {
      return cache.get(text)!;
    }
    
    const decoded = EmailDecoder.fixGarbledText(
      EmailDecoder.decodeMimeHeader(
        EmailDecoder.decodeQuotedPrintable(text)
      )
    );
    
    if (cache) {
      cache.set(text, decoded);
    }
    
    return decoded;
  }
  
  /**
   * メールアドレス正規化
   */
  static normalizeEmail(email: string): string {
    if (!email || typeof email !== 'string') return '';
    
    return email
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '')
      .replace(/[<>]/g, '');
  }
  
  /**
   * 検索用テキスト正規化
   */
  static normalizeForSearch(text: string): string {
    if (!text || typeof text !== 'string') return '';
    
    return EmailDecoder.normalizeSearchKeyword(
      this.decodeWithCache(text)
    );
  }
  
  /**
   * 日本語検出
   */
  static detectJapanese(text: string): boolean {
    if (!text || typeof text !== 'string') return false;
    
    return /[一-龯ひらがなカタカナ]/.test(text);
  }
  
  /**
   * エンコーディング品質評価
   */
  static assessEncodingQuality(record: any): string {
    const text = (record.subject || '') + ' ' + (record.body || '');
    
    // 文字化けパターンの検出
    const garbledPatterns = [
      /[àáâãäåæçèéêë]/g,
      /ã[^\w]/g,
      /é[\x00-\x1f]/g
    ];
    
    let garbledCount = 0;
    garbledPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) garbledCount += matches.length;
    });
    
    const totalLength = text.length;
    if (totalLength === 0) return 'unknown';
    
    const garbledRatio = garbledCount / totalLength;
    
    if (garbledRatio > 0.1) return 'poor';
    if (garbledRatio > 0.01) return 'fair';
    return 'good';
  }
  
  /**
   * データ品質スコア計算
   */
  static calculateQualityScore(record: any): number {
    let score = 100;
    
    // 必須フィールドチェック
    if (!record.subject || record.subject.trim() === '') score -= 20;
    if (!record.body || record.body.trim() === '') score -= 15;
    if (!record.from_email || record.from_email.trim() === '') score -= 25;
    if (!record.to_email || record.to_email.trim() === '') score -= 10;
    
    // エンコーディング品質
    const encodingQuality = this.assessEncodingQuality(record);
    if (encodingQuality === 'poor') score -= 30;
    if (encodingQuality === 'fair') score -= 15;
    
    // 文字列長チェック
    const subjectLength = (record.subject || '').length;
    const bodyLength = (record.body || '').length;
    
    if (subjectLength > 1000) score -= 5; // 異常に長い件名
    if (bodyLength > 50000) score -= 5;   // 異常に長い本文
    if (subjectLength < 3) score -= 10;   // 短すぎる件名
    
    return Math.max(0, score);
  }
  
  /**
   * CloudSQL統合デコード
   */
  static decodeCloudSQLResult(result: any) {
    if (!result || !result.rows) return result;
    
    return {
      ...result,
      rows: result.rows.map(row => DatabaseDecoder.decodeAlertData(row))
    };
  }
  
  /**
   * フロントエンド用リアルタイムデコード
   */
  static decodeForDisplay(data: any, options = {}) {
    const {
      truncateLength = 200,
      preserveHtml = false,
      highlightKeywords = []
    } = options;
    
    try {
      let decoded = {
        ...data,
        message_subject: this.decodeWithCache(data.message_subject || ''),
        message_body: this.decodeWithCache(data.message_body || ''),
        customer_name: this.decodeWithCache(data.customer_name || ''),
        detected_keyword: this.decodeWithCache(data.detected_keyword || '')
      };
      
      // HTMLエスケープ（必要に応じて）
      if (!preserveHtml) {
        decoded.message_body = EmailDecoder.stripHtml(decoded.message_body);
      }
      
      // 文字数制限
      if (truncateLength > 0) {
        decoded.message_body = decoded.message_body.substring(0, truncateLength);
        if (data.message_body && data.message_body.length > truncateLength) {
          decoded.message_body += '...';
        }
      }
      
      // キーワードハイライト
      if (highlightKeywords.length > 0) {
        decoded = this.highlightKeywords(decoded, highlightKeywords);
      }
      
      return decoded;
      
    } catch (error) {
      console.warn('表示用デコードエラー:', error);
      return data;
    }
  }
  
  /**
   * キーワードハイライト
   */
  static highlightKeywords(data: any, keywords: string[]) {
    const fields = ['message_subject', 'message_body', 'detected_keyword'];
    
    fields.forEach(field => {
      if (data[field] && typeof data[field] === 'string') {
        keywords.forEach(keyword => {
          const regex = new RegExp(`(${keyword})`, 'gi');
          data[field] = data[field].replace(regex, '<mark>$1</mark>');
        });
      }
    });
    
    return data;
  }
  
  /**
   * 一括処理用ヘルパー
   */
  static async processLargeDataset(
    dataSource: 'bigquery' | 'cloudsql',
    query: string,
    options = {}
  ) {
    const {
      batchSize = 1000,
      maxRecords = 100000,
      enableProgressLog = true
    } = options;
    
    console.log(`🚀 大規模データセット処理開始: ${dataSource}`);
    
    try {
      let processedCount = 0;
      let totalProcessed = 0;
      
      // データソース別処理
      if (dataSource === 'bigquery') {
        const { BigQuery } = require('@google-cloud/bigquery');
        const bigquery = new BigQuery({ projectId: 'viewpers' });
        
        const [rows] = await bigquery.query(query);
        const limitedRows = rows.slice(0, maxRecords);
        
        return await this.decodeBigQueryBatch(limitedRows, {
          batchSize,
          logProgress: enableProgressLog
        });
        
      } else if (dataSource === 'cloudsql') {
        const { Client } = require('pg');
        const client = new Client({
          host: '34.146.200.199',
          port: 5432,
          user: 'postgres',
          password: 'salesguard123',
          database: 'salesguard',
          ssl: { rejectUnauthorized: false }
        });
        
        await client.connect();
        const result = await client.query(query);
        await client.end();
        
        return this.decodeCloudSQLResult(result);
      }
      
    } catch (error) {
      console.error(`❌ ${dataSource}処理エラー:`, error);
      throw error;
    }
  }
} 
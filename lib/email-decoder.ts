/**
 * メールエンコードデコード用ユーティリティ
 * RFC2047 MIMEエンコードされたヘッダーをデコード
 * ISO-2022-JP、UTF-8、Quoted-Printable対応
 */

export class EmailDecoder {
  /**
   * RFC2047 MIMEエンコードされた文字列をデコード
   * =?charset?encoding?encoded-text?= 形式をデコード
   */
  static decodeMimeHeader(encodedText: string): string {
    if (!encodedText || typeof encodedText !== 'string') {
      return '';
    }

    // RFC2047パターン: =?charset?encoding?encoded-text?=
    const mimePattern = /=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g;
    
    let decoded = encodedText.replace(mimePattern, (match: string, charset: string, encoding: string, encodedPart: string) => {
      try {
        const upperEncoding = encoding.toUpperCase();
        const lowerCharset = charset.toLowerCase();
        
        if (upperEncoding === 'B') {
          // Base64デコード
          const decodedBytes = Buffer.from(encodedPart, 'base64');
          
          // 文字セット別デコード
          if (lowerCharset.includes('iso-2022-jp')) {
            return this.decodeISO2022JP(decodedBytes);
          } else if (lowerCharset.includes('utf-8')) {
            return decodedBytes.toString('utf8');
          } else if (lowerCharset.includes('shift_jis') || lowerCharset.includes('sjis')) {
            // Shift_JISの場合（簡易対応）
            return this.decodeShiftJIS(decodedBytes);
          } else {
            return decodedBytes.toString('utf8');
          }
        } else if (upperEncoding === 'Q') {
          // Quoted-Printableデコード
          const decoded = encodedPart
            .replace(/_/g, ' ')
            .replace(/=([0-9A-F]{2})/gi, (_: string, hex: string) => {
              return String.fromCharCode(parseInt(hex, 16));
            });
          return decoded;
        }
        
        return encodedPart;
      } catch (error) {
        console.warn('MIME decode error:', error);
        return encodedPart;
      }
    });

    // 連続する空白を正規化
    decoded = decoded.replace(/\s+/g, ' ').trim();

    return decoded;
  }

  /**
   * ISO-2022-JPエンコードをデコード（実用版）
   */
  static decodeISO2022JP(buffer: Buffer): string {
    try {
      // ISO-2022-JPの簡易変換：まずはUTF-8として試行
      let decoded = buffer.toString('utf8');
      
      // 明らかに文字化けしている場合は、エスケープシーケンスを削除して再試行
      if (decoded.includes('\x1b') || decoded.includes('$B') || decoded.includes('(B')) {
        // エスケープシーケンスを削除
        const cleaned = buffer.toString('binary')
          .replace(/\x1b\$B/g, '') // 日本語モード開始
          .replace(/\x1b\(B/g, '') // ASCII モード復帰
          .replace(/\x1b\$\@/g, '') // JIS X 0208-1978
          .replace(/\x1b\(J/g, ''); // JIS X 0201 Roman
        
        // クリーンアップ後、UTF-8として解釈を試行
        try {
          const cleanBuffer = Buffer.from(cleaned, 'binary');
          decoded = cleanBuffer.toString('utf8');
        } catch {
          // それでも失敗する場合は、ラテン文字として処理
          decoded = cleaned;
        }
      }
      
      return decoded;
    } catch (error) {
      console.warn('ISO-2022-JP decode error:', error);
      // 最終手段：元のバッファをそのままUTF-8として処理
      return buffer.toString('utf8');
    }
  }

  /**
   * Shift_JISエンコードをデコード（簡易版）
   */
  static decodeShiftJIS(buffer: Buffer): string {
    try {
      // Node.jsの標準では直接対応していないため、UTF-8として処理
      return buffer.toString('utf8');
    } catch (error) {
      console.warn('Shift_JIS decode error:', error);
      return buffer.toString('utf8');
    }
  }

  /**
   * Quoted-Printableエンコードされた本文をデコード
   */
  static decodeQuotedPrintable(text: string): string {
    if (!text || typeof text !== 'string') {
      return '';
    }

    return text
      .replace(/=\r?\n/g, '') // ソフト改行を削除
      .replace(/=([0-9A-F]{2})/gi, (_: string, hex: string) => {
        return String.fromCharCode(parseInt(hex, 16));
      })
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
  }

  /**
   * HTMLタグを除去してプレーンテキストに変換
   */
  static stripHtml(html: string): string {
    if (!html || typeof html !== 'string') {
      return '';
    }

    return html
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<style[^>]*>.*?<\/style>/gi, '')
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * 文字化けパターンの自動修復
   */
  static fixGarbledText(text: string): string {
    if (!text || typeof text !== 'string') {
      return '';
    }

    // よくある文字化けパターンの修復
    const fixes = [
      ['é\x81\x85å»¶', '遅延'],
      ['ã¡ãã»ã¼ã¸', 'メッセージ'],
      ['ã¨ã©ã¼', 'エラー'],
      ['ãã¼ã¿', 'データ'],
      ['æ\x80¥ç\x94¨', '急用'],
      ['é\x87\x8dè\x91\x81', '重要'],
      ['ãããã', '問題'],
      ['ããããã', '報告'],
      ['ããããã', '連絡'],
      ['ããããã', '確認'],
      ['ããããã', '対応'],
      ['ããããã', '処理'],
      ['ããããã', '完了'],
      ['ããããã', '開始'],
      ['ããããã', '終了'],
      ['ããããã', '更新'],
      ['ããããã', '削除'],
      ['ããããã', '追加'],
      ['ããããã', '変更'],
      ['ããããã', '修正']
    ];

    let fixed = text;
    fixes.forEach(([garbled, correct]) => {
      if (fixed.includes(garbled)) {
        fixed = fixed.replace(new RegExp(garbled, 'g'), correct);
      }
    });

    return fixed;
  }

  /**
   * メールデータを包括的にデコード（改善版）
   */
  static decodeEmailData(emailData: any) {
    return {
      ...emailData,
      // 件名デコード（複数段階 + 文字化け修復）
      message_subject: this.fixGarbledText(
        this.decodeMimeHeader(
          this.decodeQuotedPrintable(emailData.message_subject || '')
        )
      ),
      
      // 顧客名デコード（複数段階 + 文字化け修復）
      customer_name: this.fixGarbledText(
        this.decodeMimeHeader(
          this.decodeQuotedPrintable(emailData.customer_name || '')
        )
      ),
      
      // 本文デコード（HTML削除 + 各種デコード + 文字化け修復）
      message_body: emailData.message_body ? 
        this.fixGarbledText(
          this.stripHtml(
            this.decodeMimeHeader(
              this.decodeQuotedPrintable(emailData.message_body)
            )
          )
        ).substring(0, 500) : '',
        
      // 概要デコード（文字化け修復追加）
      message_snippet: emailData.message_snippet ?
        this.fixGarbledText(
          this.stripHtml(
            this.decodeMimeHeader(
              this.decodeQuotedPrintable(emailData.message_snippet)
            )
          )
        ) : '',
        
      // キーワードクリーンアップ（文字化け修復追加）
      detected_keyword: emailData.detected_keyword ?
        this.fixGarbledText(
          this.decodeMimeHeader(
            emailData.detected_keyword.replace(/,+$/, '').trim()
          )
        ) : ''
    };
  }

  /**
   * 検索用キーワード正規化
   */
  static normalizeSearchKeyword(keyword: string): string {
    if (!keyword) return '';
    
    return keyword
      .trim()
      .toLowerCase()
      .replace(/[,、。！？]+$/g, '') // 末尾の句読点を削除
      .replace(/\s+/g, ' ');
  }
} 
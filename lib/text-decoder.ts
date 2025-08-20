// 文字化けデータの前処理・復号化システム

export interface DecodeResult {
  success: boolean
  decodedText: string
  encodingType: string
  confidence: number
  originalLength: number
  decodedLength: number
}

export class TextDecoder {
  
  // メインの復号化処理
  static decodeText(text: string): DecodeResult {
    if (!text || text.length === 0) {
      return {
        success: false,
        decodedText: text,
        encodingType: 'none',
        confidence: 0,
        originalLength: 0,
        decodedLength: 0
      }
    }

    // 各種エンコーディングパターンの検出と復号化
    const results = [
      this.decodeBase64(text),
      this.decodeMIME(text),
      this.decodeURL(text),
      this.decodeShiftJIS(text)
    ]

    // 最も信頼度の高い結果を選択
    const bestResult = results.reduce((best, current) => 
      current.confidence > best.confidence ? current : best
    )

    return bestResult
  }

  // Base64エンコードの復号化（Shift-JIS）
  private static decodeBase64(text: string): DecodeResult {
    try {
      // Base64パターンの検出: $B...$B
      if (!text.includes('$B') || !text.includes('(B')) {
        return {
          success: false,
          decodedText: text,
          encodingType: 'base64_shiftjis',
          confidence: 0,
          originalLength: text.length,
          decodedLength: text.length
        }
      }

      // Base64部分の抽出
      const base64Pattern = /\$B([^$]+)\$B/g
      let decodedText = text
      let totalDecoded = 0
      let confidence = 0

      decodedText = decodedText.replace(base64Pattern, (match, base64Content) => {
        try {
          // Base64デコード
          const decoded = this.decodeBase64String(base64Content)
          if (decoded) {
            totalDecoded += decoded.length
            confidence += 0.8 // Base64デコード成功
            return decoded
          }
        } catch (error) {
          console.warn('Base64デコードエラー:', error)
        }
        return match
      })

      // 信頼度の計算
      const base64Ratio = (text.match(/\$B/g) || []).length / 2
      confidence = Math.min(confidence + base64Ratio * 0.1, 1.0)

      return {
        success: confidence > 0.3,
        decodedText,
        encodingType: 'base64_shiftjis',
        confidence,
        originalLength: text.length,
        decodedLength: decodedText.length
      }

    } catch (error) {
      return {
        success: false,
        decodedText: text,
        encodingType: 'base64_shiftjis',
        confidence: 0,
        originalLength: text.length,
        decodedLength: text.length
      }
    }
  }

  // MIMEエンコードの復号化
  private static decodeMIME(text: string): DecodeResult {
    try {
      // MIMEパターンの検出: =?charset?encoding?data?=
      const mimePattern = /=([?][^?]*[?][^?]*[?][^?]*[?])=/g
      
      if (!mimePattern.test(text)) {
        return {
          success: false,
          decodedText: text,
          encodingType: 'mime',
          confidence: 0,
          originalLength: text.length,
          decodedLength: text.length
        }
      }

      let decodedText = text
      let confidence = 0

      // MIMEデコードの実装（簡易版）
      decodedText = decodedText.replace(/=\?([^?]*)\?([^?]*)\?([^?]*)\?=/g, (match, charset, encoding, data) => {
        try {
          if (encoding.toLowerCase() === 'b') {
            // Base64エンコード
            const decoded = this.decodeBase64String(data)
            if (decoded) {
              confidence += 0.6
              return decoded
            }
          } else if (encoding.toLowerCase() === 'q') {
            // Quoted-printableエンコード
            const decoded = this.decodeQuotedPrintable(data)
            if (decoded) {
              confidence += 0.7
              return decoded
            }
          }
        } catch (error) {
          console.warn('MIMEデコードエラー:', error)
        }
        return match
      })

      return {
        success: confidence > 0.3,
        decodedText,
        encodingType: 'mime',
        confidence,
        originalLength: text.length,
        decodedLength: decodedText.length
      }

    } catch (error) {
      return {
        success: false,
        decodedText: text,
        encodingType: 'mime',
        confidence: 0,
        originalLength: text.length,
        decodedLength: text.length
      }
    }
  }

  // URLエンコードの復号化
  private static decodeURL(text: string): DecodeResult {
    try {
      // URLエンコードパターンの検出: %XX
      const urlPattern = /%[0-9A-Fa-f]{2}/g
      
      if (!urlPattern.test(text)) {
        return {
          success: false,
          decodedText: text,
          encodingType: 'url',
          confidence: 0,
          originalLength: text.length,
          decodedLength: text.length
        }
      }

      let decodedText = text
      let confidence = 0

      // URLデコード
      decodedText = decodedText.replace(/%([0-9A-Fa-f]{2})/g, (match, hex) => {
        try {
          const charCode = parseInt(hex, 16)
          const char = String.fromCharCode(charCode)
          confidence += 0.1
          return char
        } catch (error) {
          return match
        }
      })

      // 信頼度の計算（URLエンコードされた文字の割合）
      const encodedChars = (text.match(/%[0-9A-Fa-f]{2}/g) || []).length
      const totalChars = text.length
      confidence = Math.min(confidence + (encodedChars / totalChars) * 0.5, 1.0)

      return {
        success: confidence > 0.2,
        decodedText,
        encodingType: 'url',
        confidence,
        originalLength: text.length,
        decodedLength: decodedText.length
      }

    } catch (error) {
      return {
        success: false,
        decodedText: text,
        encodingType: 'url',
        confidence: 0,
        originalLength: text.length,
        decodedLength: text.length
      }
    }
  }

  // Shift-JISエンコードの復号化
  private static decodeShiftJIS(text: string): DecodeResult {
    try {
      // Shift-JISパターンの検出（簡易版）
      const shiftJISPattern = /[\x80-\xFF][\x40-\x7E\x80-\xFC]/g
      
      if (!shiftJISPattern.test(text)) {
        return {
          success: false,
          decodedText: text,
          encodingType: 'shiftjis',
          confidence: 0,
          originalLength: text.length,
          decodedLength: text.length
        }
      }

      // 簡易的なShift-JISデコード（実際の実装ではiconv-lite等を使用）
      let confidence = 0.3
      let decodedText = text

      // 基本的な文字化けパターンの修正
      decodedText = decodedText
        .replace(/\$B/g, '')
        .replace(/\(B/g, '')
        .replace(/\$([0-9A-F]{2})/g, (match, hex) => {
          try {
            const charCode = parseInt(hex, 16)
            if (charCode >= 0x80 && charCode <= 0xFF) {
              confidence += 0.1
              return String.fromCharCode(charCode)
            }
          } catch (error) {
            // 無視
          }
          return match
        })

      return {
        success: confidence > 0.3,
        decodedText,
        encodingType: 'shiftjis',
        confidence,
        originalLength: text.length,
        decodedLength: decodedText.length
      }

    } catch (error) {
      return {
        success: false,
        decodedText: text,
        encodingType: 'shiftjis',
        confidence: 0,
        originalLength: text.length,
        decodedLength: text.length
      }
    }
  }

  // Base64文字列のデコード
  private static decodeBase64String(base64: string): string | null {
    try {
      // Base64文字列の正規化
      const normalized = base64.replace(/[^A-Za-z0-9+/]/g, '')
      
      if (normalized.length === 0) return null

      // Base64デコード
      const decoded = Buffer.from(normalized, 'base64')
      
      // Shift-JISとして解釈を試行
      try {
        return decoded.toString('binary')
      } catch (error) {
        // UTF-8として解釈を試行
        try {
          return decoded.toString('utf8')
        } catch (error) {
          // バイナリとして解釈
          return decoded.toString('binary')
        }
      }
    } catch (error) {
      return null
    }
  }

  // Quoted-printableエンコードのデコード
  private static decodeQuotedPrintable(text: string): string | null {
    try {
      return text.replace(/=([0-9A-Fa-f]{2})/g, (match, hex) => {
        try {
          const charCode = parseInt(hex, 16)
          return String.fromCharCode(charCode)
        } catch (error) {
          return match
        }
      })
    } catch (error) {
      return null
    }
  }

  // テキストの品質評価
  static evaluateTextQuality(text: string): {
    readability: number
    japaneseRatio: number
    encodingIssues: number
  } {
    if (!text) {
      return { readability: 0, japaneseRatio: 0, encodingIssues: 0 }
    }

    // 日本語文字の割合
    const japaneseChars = (text.match(/[あ-んア-ン一-龯]/g) || []).length
    const japaneseRatio = japaneseChars / text.length

    // エンコーディング問題の検出
    const encodingIssues = (text.match(/[\$B\(B%\\x\\u]/g) || []).length

    // 可読性スコア（簡易版）
    let readability = 1.0
    
    // エンコーディング問題が多いほど可読性が下がる
    readability -= (encodingIssues / text.length) * 0.5
    
    // 日本語文字が多いほど可読性が上がる
    readability += japaneseRatio * 0.3
    
    // 0-1の範囲に正規化
    readability = Math.max(0, Math.min(1, readability))

    return {
      readability,
      japaneseRatio,
      encodingIssues
    }
  }

  // バッチ処理による一括復号化
  static batchDecode(texts: string[]): Array<DecodeResult> {
    return texts.map(text => this.decodeText(text))
  }

  // 復号化結果の統計
  static getDecodingStats(results: DecodeResult[]): {
    total: number
    successful: number
    failed: number
    avgConfidence: number
    encodingTypes: Record<string, number>
  } {
    const stats = {
      total: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      avgConfidence: 0,
      encodingTypes: {} as Record<string, number>
    }

    if (results.length > 0) {
      stats.avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length
      
      results.forEach(result => {
        stats.encodingTypes[result.encodingType] = (stats.encodingTypes[result.encodingType] || 0) + 1
      })
    }

    return stats
  }
} 
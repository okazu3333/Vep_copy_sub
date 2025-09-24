import { NextResponse } from 'next/server'
import { TextDecoder, DecodeResult } from '@/lib/text-decoder'

export async function POST(request: NextRequest) {
  try {
    const { action, text, limit = 5 } = await request.json()

    console.log(`🔍 テキストデコーダーテスト開始: ${action}`)

    switch (action) {
      case 'decode_single':
        return await decodeSingleText(text)
      case 'decode_samples':
        return await decodeSampleTexts(limit)
      case 'quality_analysis':
        return await analyzeTextQuality(text)
      default:
        return NextResponse.json({
          success: false,
          error: '無効なアクションです'
        }, { status: 400 })
    }

  } catch (error) {
    console.error('テキストデコーダーテストエラー:', error)
    return NextResponse.json({
      success: false,
      error: '処理中にエラーが発生しました',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// 単一テキストの復号化テスト
async function decodeSingleText(text: string) {
  try {
    if (!text) {
      return NextResponse.json({
        success: false,
        error: 'テキストが提供されていません'
      }, { status: 400 })
    }

    console.log('📝 単一テキスト復号化テスト開始')
    console.log('元テキスト:', text.substring(0, 100) + '...')

    // 復号化実行
    const decodeResult = TextDecoder.decodeText(text)
    
    // テキスト品質評価
    const qualityResult = TextDecoder.evaluateTextQuality(text)
    const decodedQualityResult = TextDecoder.evaluateTextQuality(decodeResult.decodedText)

    return NextResponse.json({
      success: true,
      message: '単一テキスト復号化テストが完了しました',
      data: {
        original: {
          text: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
          length: text.length,
          quality: qualityResult
        },
        decoded: {
          text: decodeResult.decodedText.substring(0, 200) + (decodeResult.decodedText.length > 200 ? '...' : ''),
          length: decodeResult.decodedText.length,
          quality: decodedQualityResult
        },
        decodeResult,
        improvement: {
          readability: decodedQualityResult.readability - qualityResult.readability,
          japaneseRatio: decodedQualityResult.japaneseRatio - qualityResult.japaneseRatio,
          encodingIssues: qualityResult.encodingIssues - decodedQualityResult.encodingIssues
        }
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('単一テキスト復号化テストエラー:', error)
    throw error
  }
}

// サンプルテキストの復号化テスト
async function decodeSampleTexts(limit: number) {
  try {
    console.log(`📝 サンプルテキスト復号化テスト開始 (${limit}件)`)

    // サンプルテキスト（実際のデータから取得）
    const sampleTexts = [
      // Base64エンコードされたテキスト
      " $B0KF#MM (B\n\n $B$*@$OC$K$J$C$F$*$j$^$9!#>.?9$G$9!# (B",
      
      // MIMEエンコードされたテキスト
      "・・‥‥……━━━━━━━━━━（ 2025年 7月 11日発行 ）━━━\n\n〜ITと経営の融合でビジネスの課題を解決するビジネス情報サイト〜",
      
      // URLエンコードされたテキスト
      "リサーチャー各位\n\nWEBディレクション部　山本 修司さん　より、新規に仕事の依頼が来ました。\nアサインをお願いいたします。",
      
      // クリーンテキスト
      "お世話になっております。小森です。\n\n営業担当者様にご連絡いただき、ありがとうございます。\nこの度、営業担当者様のcc に営業担当者様以外の方も追加させていただきました。",
      
      // 複合エンコード
      " $B$$$D$b$*@$OC$K$J$C$F$*$j$^$9!# (B\n\n $B$$$h$$$h$47@Ls:G=*7n$H$J$j$^$7$?$N$G$4O\"Mm$5$;$F$$$?$@$-ま$9!# (B"
    ].slice(0, limit)

    const results: Array<{
      original: string
      decoded: DecodeResult
      quality: any
      decodedQuality: any
    }> = []

    // 各サンプルテキストを復号化
    for (let i = 0; i < sampleTexts.length; i++) {
      const text = sampleTexts[i]
      const decodeResult = TextDecoder.decodeText(text)
      const quality = TextDecoder.evaluateTextQuality(text)
      const decodedQuality = TextDecoder.evaluateTextQuality(decodeResult.decodedText)

      results.push({
        original: text,
        decoded: decodeResult,
        quality,
        decodedQuality
      })
    }

    // 統計情報の計算
    const stats = TextDecoder.getDecodingStats(results.map(r => r.decoded))

    return NextResponse.json({
      success: true,
      message: 'サンプルテキスト復号化テストが完了しました',
      data: {
        results,
        stats,
        summary: {
          total_samples: results.length,
          successful_decodes: stats.successful,
          failed_decodes: stats.failed,
          avg_confidence: stats.avgConfidence,
          encoding_types: stats.encodingTypes
        }
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('サンプルテキスト復号化テストエラー:', error)
    throw error
  }
}

// テキスト品質分析
async function analyzeTextQuality(text: string) {
  try {
    if (!text) {
      return NextResponse.json({
        success: false,
        error: 'テキストが提供されていません'
      }, { status: 400 })
    }

    console.log('📊 テキスト品質分析開始')

    // 元テキストの品質評価
    const originalQuality = TextDecoder.evaluateTextQuality(text)
    
    // 復号化後の品質評価
    const decodeResult = TextDecoder.decodeText(text)
    const decodedQuality = TextDecoder.evaluateTextQuality(decodeResult.decodedText)

    // 詳細分析
    const analysis = {
      encoding_patterns: {
        base64: (text.match(/\$B/g) || []).length,
        mime: (text.match(/=\?/g) || []).length,
        url: (text.match(/%[0-9A-Fa-f]{2}/g) || []).length,
        hex: (text.match(/\\x[0-9A-Fa-f]{2}/g) || []).length
      },
      character_distribution: {
        total: text.length,
        japanese: (text.match(/[あ-んア-ン一-龯]/g) || []).length,
        ascii: (text.match(/[a-zA-Z0-9]/g) || []).length,
        symbols: (text.match(/[^\w\sあ-んア-ン一-龯]/g) || []).length
      },
      improvement_metrics: {
        readability: decodedQuality.readability - originalQuality.readability,
        japaneseRatio: decodedQuality.japaneseRatio - originalQuality.japaneseRatio,
        encodingIssues: originalQuality.encodingIssues - decodedQuality.encodingIssues
      }
    }

    return NextResponse.json({
      success: true,
      message: 'テキスト品質分析が完了しました',
      data: {
        original: {
          text: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
          quality: originalQuality
        },
        decoded: {
          text: decodeResult.decodedText.substring(0, 200) + (decodeResult.decodedText.length > 200 ? '...' : ''),
          quality: decodedQuality
        },
        decodeResult,
        analysis
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('テキスト品質分析エラー:', error)
    throw error
  }
} 
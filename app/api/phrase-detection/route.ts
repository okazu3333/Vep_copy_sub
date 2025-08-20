import { NextRequest, NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery()

// フレーズロジック定義（BigQueryから動的取得）
async function getPhraseLogic() {
  try {
    console.log('🔍 フレーズロジック取得開始')
    
    const query = `
      SELECT 
        category,
        phrases,
        priority,
        delay,
        description
      FROM \`viewpers.salesguard_data.phrase_logic\`
      ORDER BY created_at DESC
    `
    
    console.log('📝 実行クエリ:', query)
    const [rows] = await bigquery.query({ query })
    console.log('📊 取得結果:', rows.length, '件')
    
    const result = rows.map((row: any) => ({
      category: row.category,
      phrases: JSON.parse(row.phrases),
      priority: row.priority,
      delay: row.delay,
      description: row.description
    }))
    
    console.log('✅ フレーズロジック取得完了:', result.length, '件')
    return result
  } catch (error) {
    console.error('❌ フレーズロジック取得エラー:', error)
    console.log('⚠️ 空の配列を返します')
    return []
  }
}

export async function POST(request: NextRequest) {
  try {
    const { text, messageId } = await request.json()
    
    if (!text) {
      return NextResponse.json(
        { error: 'テキストが提供されていません' },
        { status: 400 }
      )
    }

    console.log('🔍 フレーズ検出開始:', { text: text.substring(0, 100) + '...' })

    // フレーズロジックを取得
    let phraseLogic = await getPhraseLogic()
    console.log('🔍 取得したフレーズロジック:', phraseLogic)
    
    // フレーズロジックが空の場合はデフォルトロジックを使用
    if (!phraseLogic || phraseLogic.length === 0) {
      console.log('⚠️ フレーズロジックが空のため、デフォルトロジックを使用')
      const defaultLogic = [
        {
          category: "緊急対応",
          phrases: ["緊急", "至急", "すぐに", "急ぎ", "早急"],
          priority: "High",
          delay: 0,
          description: "緊急対応が必要なフレーズ"
        },
        {
          category: "契約関連",
          phrases: ["契約", "見積もり", "料金", "価格", "支払い"],
          priority: "Medium",
          delay: 1,
          description: "契約関連のフレーズ"
        }
      ]
      phraseLogic = defaultLogic
    }
    
    // phraseLogicがundefinedの場合のフォールバック
    if (!phraseLogic) {
      console.log('❌ phraseLogicがundefinedのため、デフォルトロジックを使用')
      phraseLogic = [
        {
          category: "緊急対応",
          phrases: ["緊急", "至急", "すぐに", "急ぎ", "早急"],
          priority: "High",
          delay: 0,
          description: "緊急対応が必要なフレーズ"
        },
        {
          category: "契約関連",
          phrases: ["契約", "見積もり", "料金", "価格", "支払い"],
          priority: "Medium",
          delay: 1,
          description: "契約関連のフレーズ"
        }
      ]
    }
    
    console.log('📋 使用するフレーズロジック:', phraseLogic.length, 'カテゴリ')
    
    // フレーズ検出ロジック
    const detectedPhrases: Array<{
      category: string;
      phrase: string;
      priority: string;
      delay: number;
      description: string;
      matchedText: string;
    }> = []
    
    try {
      phraseLogic.forEach(logic => {
        if (logic && logic.phrases && Array.isArray(logic.phrases)) {
          logic.phrases.forEach((phrase: string) => {
            if (text.toLowerCase().includes(phrase.toLowerCase())) {
              detectedPhrases.push({
                category: logic.category,
                phrase: phrase,
                priority: logic.priority,
                delay: logic.delay,
                description: logic.description,
                matchedText: text.substring(
                  Math.max(0, text.toLowerCase().indexOf(phrase.toLowerCase()) - 20),
                  text.toLowerCase().indexOf(phrase.toLowerCase()) + phrase.length + 20
                )
              })
            }
          })
        } else {
          console.log('⚠️ 無効なロジックオブジェクト:', logic)
        }
      })
    } catch (error) {
      console.error('❌ フレーズ検出処理エラー:', error)
    }

    // 検出結果をBigQueryに保存
    if (detectedPhrases.length > 0) {
      const detectionData = detectedPhrases.map(detection => ({
        message_id: messageId,
        category: detection.category,
        phrase: detection.phrase,
        priority: detection.priority,
        delay: detection.delay,
        description: detection.description,
        matched_text: detection.matchedText,
        detected_at: new Date().toISOString()
      }))

      const query = `
        INSERT INTO \`viewpers.salesguard_data.phrase_detections\`
        (message_id, category, phrase, priority, delay, description, matched_text, detected_at)
        VALUES
        ${detectionData.map((_, index) => `(@messageId${index}, @category${index}, @phrase${index}, @priority${index}, @delay${index}, @description${index}, @matchedText${index}, @detectedAt${index})`).join(',')}
      `

      const params: any = {}
      detectionData.forEach((data, index) => {
        params[`messageId${index}`] = data.message_id
        params[`category${index}`] = data.category
        params[`phrase${index}`] = data.phrase
        params[`priority${index}`] = data.priority
        params[`delay${index}`] = data.delay
        params[`description${index}`] = data.description
        params[`matchedText${index}`] = data.matched_text
        params[`detectedAt${index}`] = data.detected_at
      })

      await bigquery.query({ query, params })
      console.log('✅ フレーズ検出結果をBigQueryに保存:', detectedPhrases.length, '件')
    }

    return NextResponse.json({
      success: true,
      detectedPhrases,
      totalDetections: detectedPhrases.length
    })

  } catch (error) {
    console.error('❌ フレーズ検出エラー:', error)
    return NextResponse.json(
      {
        error: 'フレーズ検出に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const messageId = searchParams.get('messageId')
    const category = searchParams.get('category')

    let query = `
      SELECT 
        message_id,
        category,
        phrase,
        priority,
        delay,
        description,
        matched_text,
        detected_at
      FROM \`viewpers.salesguard_data.phrase_detections\`
      WHERE 1=1
    `

    const params: any = {}

    if (messageId) {
      query += ' AND message_id = @messageId'
      params.messageId = messageId
    }

    if (category) {
      query += ' AND category = @category'
      params.category = category
    }

    query += ' ORDER BY detected_at DESC LIMIT 100'

    const [rows] = await bigquery.query({ query, params })

    return NextResponse.json({
      success: true,
      detections: rows,
      total: rows.length
    })

  } catch (error) {
    console.error('❌ フレーズ検出履歴取得エラー:', error)
    return NextResponse.json(
      {
        error: 'フレーズ検出履歴の取得に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 
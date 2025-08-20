import { NextRequest, NextResponse } from 'next/server'

// Hugging Face API設定
const HUGGINGFACE_API_URL = 'https://api-inference.huggingface.co/models'
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY || 'hf_xxx' // 環境変数から取得

// 日本語感情分析用のモデル
const SENTIMENT_MODELS = {
  'japanese-bert': 'cl-tohoku/bert-base-japanese-v3',
  'japanese-gpt': 'rinna/japanese-gpt-neox-3.6b',
  'line-japanese': 'line-corporation/japanese-large-lm'
}

export async function POST(request: NextRequest) {
  try {
    const { text, model = 'japanese-bert' } = await request.json()
    
    if (!text) {
      return NextResponse.json(
        { success: false, error: 'テキストが提供されていません' },
        { status: 400 }
      )
    }

    console.log(`🔍 Hugging Face APIで感情分析開始: ${model}`)
    console.log(`📝 分析対象テキスト: ${text.substring(0, 100)}...`)

    // Hugging Face APIを呼び出し
    const sentimentResult = await analyzeSentimentWithHuggingFace(text, model)
    
    return NextResponse.json({
      success: true,
      model: model,
      text: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
      sentiment: sentimentResult,
      message: 'Hugging Face APIによる感情分析が完了しました'
    })

  } catch (error) {
    console.error('❌ Hugging Face感情分析エラー:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: '感情分析中にエラーが発生しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

async function analyzeSentimentWithHuggingFace(text: string, modelKey: string): Promise<any> {
  const model = SENTIMENT_MODELS[modelKey as keyof typeof SENTIMENT_MODELS]
  
  if (!model) {
    throw new Error(`サポートされていないモデル: ${modelKey}`)
  }

  try {
    // Hugging Face APIにリクエスト
    const response = await fetch(`${HUGGINGFACE_API_URL}/${model}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: text,
        parameters: {
          max_length: 512,
          return_all_scores: true
        }
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Hugging Face API エラー: ${response.status} - ${errorText}`)
    }

    const result = await response.json()
    console.log(`✅ Hugging Face API レスポンス:`, result)

    // 結果を感情分析用に変換
    return transformHuggingFaceResult(result, text)

  } catch (error) {
    console.error(`❌ Hugging Face API呼び出しエラー:`, error)
    
    // APIエラーの場合、フォールバックとしてルールベース分析を実行
    console.log(`🔄 フォールバック: ルールベース感情分析を実行`)
    return fallbackRuleBasedAnalysis(text)
  }
}

function transformHuggingFaceResult(result: any, text: string): any {
  // Hugging Faceの結果を感情分析用に変換
  // モデルによって結果の形式が異なるため、適応的に処理
  
  if (Array.isArray(result)) {
    // 分類結果の場合
    return {
      method: 'huggingface_classification',
      confidence: result[0]?.score || 0,
      label: result[0]?.label || 'unknown',
      all_scores: result,
      raw_result: result
    }
  } else if (result.generated_text) {
    // 生成結果の場合
    return {
      method: 'huggingface_generation',
      generated_text: result.generated_text,
      raw_result: result
    }
  } else {
    // その他の結果形式
    return {
      method: 'huggingface_other',
      raw_result: result
    }
  }
}

function fallbackRuleBasedAnalysis(text: string): any {
  // ルールベースの感情分析（フォールバック用）
  const positiveWords = ['ありがとう', '感謝', '素晴らしい', '良い', '満足', '喜び', '嬉しい', '楽しい', '期待', '希望', '成功', '達成', '完了', '承知', '了解', '承諾', '承認', '同意', '賛成', '支持', '応援']
  const negativeWords = ['問題', '困った', '困っています', '大変', '難しい', '複雑', '遅い', '遅延', '失敗', 'エラー', 'バグ', '不具合', '故障', '品質', '悪い', '粗悪', '不満', '苦情', 'クレーム', '謝罪', '申し訳', 'すみません', 'ご迷惑', 'キャンセル', '解約', '中止', '停止', '終了', '破棄', '取り消し']
  const urgentWords = ['緊急', '至急', '急ぎ', '早急', 'すぐ', '今すぐ', '即座', '即時', '期限', '締切', '納期', '間に合わない', '遅れる', '遅延', 'トラブル', '障害', '停止', 'ダウン']

  let positiveScore = 0
  let negativeScore = 0
  let urgentScore = 0

  // テキスト内のキーワードをカウント
  positiveWords.forEach(word => {
    const regex = new RegExp(word, 'gi')
    const matches = text.match(regex)
    if (matches) positiveScore += matches.length
  })

  negativeWords.forEach(word => {
    const regex = new RegExp(word, 'gi')
    const matches = text.match(regex)
    if (matches) negativeScore += matches.length
  })

  urgentWords.forEach(word => {
    const regex = new RegExp(word, 'gi')
    const matches = text.match(regex)
    if (matches) urgentScore += matches.length
  })

  // 感情スコアを計算
  const totalScore = positiveScore + negativeScore + urgentScore
  let dominantEmotion = 'neutral'
  let confidence = 0

  if (totalScore > 0) {
    if (positiveScore > negativeScore && positiveScore > urgentScore) {
      dominantEmotion = 'positive'
      confidence = positiveScore / totalScore
    } else if (negativeScore > positiveScore && negativeScore > urgentScore) {
      dominantEmotion = 'negative'
      confidence = negativeScore / totalScore
    } else if (urgentScore > positiveScore && urgentScore > negativeScore) {
      dominantEmotion = 'urgent'
      confidence = urgentScore / totalScore
    }
  }

  return {
    method: 'rule_based_fallback',
    dominant_emotion: dominantEmotion,
    confidence: Math.round(confidence * 100) / 100,
    scores: {
      positive: positiveScore,
      negative: negativeScore,
      urgent: urgentScore
    },
    total_score: totalScore
  }
}

// GET メソッドで利用可能なモデル一覧を取得
export async function GET() {
  return NextResponse.json({
    success: true,
    available_models: Object.keys(SENTIMENT_MODELS),
    models: SENTIMENT_MODELS,
    api_info: {
      provider: 'Hugging Face',
      free_tier: '30,000 requests/month',
      pricing: 'Free tier available',
      documentation: 'https://huggingface.co/docs/api-inference'
    }
  })
} 
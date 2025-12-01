import { NextRequest, NextResponse } from 'next/server'

import { analyzeSentiment } from '@/lib/ai/sentiment-client'
import { HUGGINGFACE_SENTIMENT_MODELS } from '@/lib/ai/providers/huggingface'

export async function POST(request: NextRequest) {
  try {
    const { text, model = 'japanese-bert' } = await request.json()

    if (!text) {
      return NextResponse.json(
        { success: false, error: 'テキストが提供されていません' },
        { status: 400 }
      )
    }

    console.log(`🔍 Sentiment analysis started (provider=${process.env.SENTIMENT_PROVIDER ?? 'huggingface'})`)
    console.log(`📝 分析対象テキスト: ${text.substring(0, 100)}...`)

    const sentimentResult = await analyzeSentiment(text, { model })

    return NextResponse.json({
      success: true,
      provider: sentimentResult.provider,
      model: sentimentResult.model ?? model,
      text: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
      sentiment: sentimentResult,
      message: '感情分析が完了しました'
    })
  } catch (error) {
    console.error('❌ 感情分析エラー:', error)
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

export async function GET() {
  return NextResponse.json({
    success: true,
    available_models: Object.keys(HUGGINGFACE_SENTIMENT_MODELS),
    models: HUGGINGFACE_SENTIMENT_MODELS,
    api_info: {
      provider: process.env.SENTIMENT_PROVIDER ?? 'huggingface',
      huggingface: {
        free_tier: '30,000 requests/month',
        pricing: 'Free tier available',
        documentation: 'https://huggingface.co/docs/api-inference'
      },
      local: {
        endpoint: process.env.LOCAL_SENTIMENT_ENDPOINT ?? '',
        note: '社内GPU/オンプレ推論エンドポイント'
      }
    }
  })
}

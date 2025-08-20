import { NextRequest, NextResponse } from 'next/server'
import { TranslationServiceClient } from '@google-cloud/translate'

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json()
    
    console.log('🌐 翻訳テスト開始:', text)
    
    const translateClient = new TranslationServiceClient({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || 'viewpers'
    })
    
    console.log('✅ 翻訳クライアント初期化完了')
    
    const [translation] = await translateClient.translateText({
      parent: `projects/${process.env.GOOGLE_CLOUD_PROJECT_ID || 'viewpers'}/locations/global`,
      contents: [text],
      sourceLanguageCode: 'ja',
      targetLanguageCode: 'en'
    })
    
    console.log('✅ 翻訳完了:', translation)
    
    const result = {
      original_text: text,
      translated_text: translation.translations?.[0]?.translatedText || '翻訳失敗',
      source_language: translation.translations?.[0]?.detectedLanguageCode || 'ja',
      success: true,
      timestamp: new Date().toISOString()
    }
    
    console.log('🎯 翻訳テスト結果:', result)
    
    return NextResponse.json(result)
    
  } catch (error) {
    console.error('❌ 翻訳テストエラー:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
} 
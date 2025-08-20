import { NextRequest, NextResponse } from 'next/server'
import { NLPAnalyzerV2 } from '@/lib/nlp-analyzer-v2'
import { PatternMatcherV2 } from '@/lib/pattern-matcher-v2'
import { TextDecoder } from '@/lib/text-decoder'

const nlpAnalyzer = new NLPAnalyzerV2()

export async function POST(request: NextRequest) {
  try {
    const { action, text, limit = 1 } = await request.json()
    
    if (action === 'debug_single_text') {
      return await debugSingleText(text)
    } else if (action === 'debug_sample_analysis') {
      return await debugSampleAnalysis(limit)
    } else {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid action. Use debug_single_text or debug_sample_analysis' 
      })
    }
  } catch (error) {
    console.error('❌ NLP分析デバッグエラー:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to debug NLP analysis', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}

async function debugSingleText(text: string) {
  console.log('🔍 単一テキストのNLP分析デバッグ開始...')
  
  try {
    // 1. テキスト前処理
    console.log('📝 元のテキスト:', text)
    const preprocessedText = TextDecoder.decodeText(text)
    console.log('🔧 前処理後のテキスト:', preprocessedText)
    
    // 2. NLP分析
    console.log('🧠 NLP分析開始...')
    const nlpResult = await nlpAnalyzer.analyzeText(preprocessedText.decodedText)
    console.log('✅ NLP分析結果:', nlpResult)
    
    // 3. パターンマッチング
    console.log('🎯 パターンマッチング開始...')
    const patternMatches = PatternMatcherV2.matchPatterns(
      'テスト件名',
      preprocessedText.decodedText,
      nlpResult
    )
    console.log('✅ パターンマッチング結果:', patternMatches)
    
    return NextResponse.json({
      success: true,
      debug_info: {
        original_text: text,
        preprocessed_text: preprocessedText,
        nlp_analysis: nlpResult,
        pattern_matches: patternMatches,
        analysis_timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('❌ 単一テキスト分析エラー:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to analyze single text',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

async function debugSampleAnalysis(limit: number) {
  console.log(`🔍 ${limit}件のサンプル分析デバッグ開始...`)
  
  try {
    // サンプルテキスト
    const sampleTexts = [
      'クレームが発生しています。至急対応をお願いします。',
      '契約のキャンセルを検討しています。',
      '提案書の内容について質問があります。',
      '支払いが遅れています。',
      'サービスに満足しています。'
    ].slice(0, limit)
    
    const results = []
    
    for (const text of sampleTexts) {
      console.log(`\n📝 サンプルテキスト: ${text}`)
      
      try {
        // 1. テキスト前処理
        const preprocessedText = TextDecoder.decodeText(text)
        console.log('🔧 前処理結果:', preprocessedText)
        
        // 2. NLP分析
        const nlpResult = await nlpAnalyzer.analyzeText(preprocessedText.decodedText)
        console.log('🧠 NLP分析結果:', nlpResult)
        
        // 3. パターンマッチング
        const patternMatches = PatternMatcherV2.matchPatterns(
          'テスト件名',
          preprocessedText.decodedText,
          nlpResult
        )
        console.log('🎯 パターンマッチング結果:', patternMatches)
        
        results.push({
          original_text: text,
          preprocessed_text: preprocessedText,
          nlp_analysis: nlpResult,
          pattern_matches: patternMatches
        })
        
      } catch (error) {
        console.error(`❌ テキスト "${text}" の分析エラー:`, error)
        results.push({
          original_text: text,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }
    
    return NextResponse.json({
      success: true,
      debug_results: results,
      analysis_timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('❌ サンプル分析エラー:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to analyze samples',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 
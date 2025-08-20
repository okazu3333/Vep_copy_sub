import { NextRequest, NextResponse } from 'next/server'
import { JapaneseNLPAnalyzer } from '@/lib/japanese-nlp-analyzer'
import { PatternMatcherV2 } from '@/lib/pattern-matcher-v2'
import { BigQuery } from '@google-cloud/bigquery'
import { PatternMatchResult } from '@/lib/nlp-analyzer-v2'

const japaneseNLPAnalyzer = new JapaneseNLPAnalyzer()
const bigquery = new BigQuery()

export async function POST(request: NextRequest) {
  try {
    const { action, text, limit = 5, saveResults = false } = await request.json()
    
    if (action === 'analyze_single_text') {
      return await analyzeSingleJapaneseText(text)
    } else if (action === 'analyze_bigquery_data') {
      return await analyzeBigQueryJapaneseData(limit, saveResults)
    } else if (action === 'test_translation') {
      return await testTranslation(text)
    } else {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid action. Use analyze_single_text, analyze_bigquery_data, or test_translation' 
      })
    }
  } catch (error) {
    console.error('❌ 日本語NLP分析APIエラー:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to process Japanese NLP analysis', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}

/**
 * 単一の日本語テキストを分析
 */
async function analyzeSingleJapaneseText(text: string) {
  console.log('🔍 単一日本語テキスト分析開始...')
  
  try {
    // 日本語NLP分析
    const japaneseResult = await japaneseNLPAnalyzer.analyzeJapaneseText(text)
    
    // パターンマッチング（翻訳後のテキストを使用）
    let patternMatches: PatternMatchResult[] = []
    if (japaneseResult.translatedText && !japaneseResult.error) {
      try {
        patternMatches = PatternMatcherV2.matchPatterns(
          'テスト件名',
          japaneseResult.translatedText,
          {
            message_id: 'test-message',
            thread_id: 'test-thread',
            subject: 'テスト件名',
            body: japaneseResult.translatedText,
            sentiment: {
              score: japaneseResult.nlpAnalysis.sentiment.score,
              magnitude: japaneseResult.nlpAnalysis.sentiment.magnitude,
              label: japaneseResult.nlpAnalysis.sentiment.score > 0 ? 'POSITIVE' : 
                     japaneseResult.nlpAnalysis.sentiment.score < 0 ? 'NEGATIVE' : 'NEUTRAL'
            },
            entities: japaneseResult.nlpAnalysis.entities,
            categories: japaneseResult.nlpAnalysis.categories,
            syntax: {
              sentences: 1,
              tokens: japaneseResult.nlpAnalysis.syntax.textLength,
              avg_sentence_length: japaneseResult.nlpAnalysis.syntax.textLength
            },
            analysis_timestamp: new Date().toISOString()
          }
        )
      } catch (error) {
        console.warn('⚠️ パターンマッチングエラー:', error)
      }
    }
    
    return NextResponse.json({
      success: true,
      analysis_result: {
        ...japaneseResult,
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

/**
 * BigQueryの日本語データを分析
 */
async function analyzeBigQueryJapaneseData(limit: number, saveResults: boolean) {
  console.log(`🚀 BigQuery日本語データ分析開始: ${limit}件`)
  
  try {
    // BigQueryから日本語データを取得
    const query = `
      SELECT message_id, thread_id, \`from\` as sender_email, subject, body, date
      FROM \`viewpers.salesguard_alerts.alerts_clean_v7_dedup\`
      WHERE (
        body NOT LIKE '$B%' AND body NOT LIKE '%$B%' AND
        body NOT LIKE '%以下のとおり配信依頼送信完了しました%' AND
        subject NOT LIKE '%配信管理システム配信完了報告%' AND
        \`from\` NOT LIKE '%info@%' AND \`from\` NOT LIKE '%noreply@%' AND
        \`from\` NOT LIKE '%support@%' AND \`from\` NOT LIKE '%magazine@%'
      )
      ORDER BY date DESC
      LIMIT ${limit}
    `
    
    console.log('📊 BigQueryクエリ実行中...')
    const [rows] = await bigquery.query({ query, useLegacySql: false })
    console.log(`✅ ${rows.length}件のデータを取得`)
    
    const analysisResults = []
    let successful = 0
    let failed = 0
    
    for (const row of rows) {
      try {
        console.log(`📝 ${successful + failed + 1}/${rows.length}件目を分析中...`)
        
        // 日本語NLP分析
        const japaneseResult = await japaneseNLPAnalyzer.analyzeJapaneseText(row.body)
        
        // パターンマッチング
        let patternMatches: PatternMatchResult[] = []
        if (japaneseResult.translatedText && !japaneseResult.error) {
          try {
            patternMatches = PatternMatcherV2.matchPatterns(
              row.subject || '',
              japaneseResult.translatedText,
              {
                message_id: row.message_id,
                thread_id: row.thread_id,
                subject: row.subject || '',
                body: japaneseResult.translatedText,
                sentiment: {
                  score: japaneseResult.nlpAnalysis.sentiment.score,
                  magnitude: japaneseResult.nlpAnalysis.sentiment.magnitude,
                  label: japaneseResult.nlpAnalysis.sentiment.score > 0 ? 'POSITIVE' : 
                         japaneseResult.nlpAnalysis.sentiment.score < 0 ? 'NEGATIVE' : 'NEUTRAL'
                },
                entities: japaneseResult.nlpAnalysis.entities,
                categories: japaneseResult.nlpAnalysis.categories,
                syntax: {
                  sentences: 1,
                  tokens: japaneseResult.nlpAnalysis.syntax.textLength,
                  avg_sentence_length: japaneseResult.nlpAnalysis.syntax.textLength
                },
                analysis_timestamp: new Date().toISOString()
              }
            )
          } catch (error) {
            console.warn(`⚠️ パターンマッチングエラー:`, error)
          }
        }
        
        const result = {
          message_id: row.message_id,
          thread_id: row.thread_id,
          sender_email: row.sender_email,
          subject: row.subject || '',
          body: row.body,
          date: row.date,
          japanese_nlp_analysis: japaneseResult,
          pattern_matches: patternMatches,
          pattern_matches_count: patternMatches.length,
          analysis_timestamp: new Date().toISOString()
        }
        
        analysisResults.push(result)
        successful++
        
        if (successful % 5 === 0) {
          console.log(`✅ ${successful}/${rows.length}件完了`)
        }
        
      } catch (error) {
        console.error(`❌ ${successful + failed + 1}件目の分析エラー:`, error)
        failed++
        
        analysisResults.push({
          message_id: row.message_id,
          thread_id: row.thread_id,
          sender_email: row.sender_email,
          subject: row.subject || '',
          body: row.body,
          date: row.date,
          japanese_nlp_analysis: null,
          pattern_matches: [],
          pattern_matches_count: 0,
          analysis_timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }
    
    // 結果をBigQueryに保存
    if (saveResults && analysisResults.length > 0) {
      try {
        await saveJapaneseNLPAnalysisResults(analysisResults)
        console.log('💾 分析結果をBigQueryに保存完了')
      } catch (error) {
        console.error('❌ BigQuery保存エラー:', error)
      }
    }
    
    // 統計情報
    const summary = {
      total_processed: rows.length,
      successful: successful,
      failed: failed,
      success_rate: ((successful / rows.length) * 100).toFixed(2) + '%',
      analysis_timestamp: new Date().toISOString()
    }
    
    console.log('🎯 BigQuery日本語データ分析完了:', summary)
    
    return NextResponse.json({
      success: true,
      summary,
      results: analysisResults.slice(0, 10), // 最初の10件のみ返す
      total_results: analysisResults.length
    })
    
  } catch (error) {
    console.error('❌ BigQuery日本語データ分析エラー:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to analyze BigQuery Japanese data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * 翻訳機能のテスト
 */
async function testTranslation(text: string) {
  console.log('🌐 翻訳機能テスト開始...')
  
  try {
    const japaneseResult = await japaneseNLPAnalyzer.analyzeJapaneseText(text)
    
    return NextResponse.json({
      success: true,
      test_result: {
        original_text: text,
        translated_text: japaneseResult.translatedText,
        translation_confidence: japaneseResult.translationConfidence,
        nlp_analysis: japaneseResult.nlpAnalysis,
        test_timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('❌ 翻訳テストエラー:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to test translation',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * 日本語NLP分析結果をBigQueryに保存
 */
async function saveJapaneseNLPAnalysisResults(results: any[]) {
  try {
    // 日本語NLP分析結果テーブルを作成（存在しない場合）
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS \`viewpers.salesguard_alerts.japanese_nlp_analysis_results\` (
        message_id STRING,
        thread_id STRING,
        sender_email STRING,
        subject STRING,
        body STRING,
        date STRING,
        japanese_nlp_analysis STRUCT<
          original_text STRING,
          translated_text STRING,
          translation_confidence FLOAT64,
          nlp_analysis STRUCT<
            sentiment_score FLOAT64,
            sentiment_magnitude FLOAT64,
            entities_count INT64,
            categories_count INT64,
            language STRING,
            text_length INT64
          >,
          error STRING
        >,
        pattern_matches_count INT64,
        analysis_timestamp TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
      )
      PARTITION BY DATE(analysis_timestamp)
      CLUSTER BY thread_id, sender_email
    `
    
    await bigquery.query({ query: createTableQuery, useLegacySql: false })
    
    // データを挿入用に整形
    const rows = results.map(result => ({
      message_id: result.message_id,
      thread_id: result.thread_id,
      sender_email: result.sender_email,
      subject: result.subject,
      body: result.body,
      date: result.date,
      japanese_nlp_analysis: {
        original_text: result.japanese_nlp_analysis?.originalText || '',
        translated_text: result.japanese_nlp_analysis?.translatedText || '',
        translation_confidence: result.japanese_nlp_analysis?.translationConfidence || 0,
        nlp_analysis: {
          sentiment_score: result.japanese_nlp_analysis?.nlpAnalysis?.sentiment?.score || 0,
          sentiment_magnitude: result.japanese_nlp_analysis?.nlpAnalysis?.sentiment?.magnitude || 0,
          entities_count: result.japanese_nlp_analysis?.nlpAnalysis?.entities?.length || 0,
          categories_count: result.japanese_nlp_analysis?.nlpAnalysis?.categories?.length || 0,
          language: result.japanese_nlp_analysis?.nlpAnalysis?.syntax?.language || 'unknown',
          text_length: result.japanese_nlp_analysis?.nlpAnalysis?.syntax?.textLength || 0
        },
        error: result.japanese_nlp_analysis?.error || null
      },
      pattern_matches_count: result.pattern_matches_count,
      analysis_timestamp: result.analysis_timestamp
    }))
    
    // BigQueryに挿入
    const dataset = bigquery.dataset('salesguard_alerts')
    const table = dataset.table('japanese_nlp_analysis_results')
    
    await table.insert(rows)
    console.log(`💾 ${rows.length}件の日本語NLP分析結果を保存完了`)
    
  } catch (error) {
    console.error('❌ 日本語NLP分析結果保存エラー:', error)
    throw error
  }
} 